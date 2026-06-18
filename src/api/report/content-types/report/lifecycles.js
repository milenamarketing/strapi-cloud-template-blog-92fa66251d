'use strict';

/**
 * Report-Lifecycles.
 *
 * 1) Verdict-Workflow: nur 'justified' verknüpft die Meldung mit dem gemeldeten Nutzer
 *    (reported_user) und erhöht dessen Reporting-Zähler; Rücknahme entfernt beides.
 * 2) Moderations-Aktion: 'delete_content' löscht den verknüpften Beitrag/Kommentar direkt
 *    aus dem Report heraus und merkt sich content_deleted.
 *
 * Idempotenz über die Flags `counted` / `content_deleted`; ein In-Memory-Lock verhindert
 * Rekursion durch die eigenen Report-Updates. Report-Updates laufen über die Document-API
 * (korrekte Relations-Syntax), der Nutzer-Zähler über die Query-Engine (Skalar).
 */

const processing = new Set();

/** Verdict → Zähler + Profil-Verknüpfung pflegen. */
async function handleVerdict(result) {
  const desiredCounted = result.verdict === 'justified';
  if (!!result.counted === desiredCounted) return; // nichts zu tun

  const field =
    result.target_type === 'comment' ? 'reporting_count_comments' : 'reporting_count_posts';

  // Nutzer über die Document-API holen (liefert documentId – nötig fürs connect).
  let user = null;
  if (result.reported_user_base44_id) {
    const found = await strapi.documents('plugin::users-permissions.user').findMany({
      filters: { base44_id: result.reported_user_base44_id },
      limit: 1,
    });
    user = found && found[0];
  }

  if (desiredCounted) {
    if (user) {
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { [field]: (user[field] || 0) + 1 },
      });
    }
    await strapi.documents('api::report.report').update({
      documentId: result.documentId,
      data: { counted: true, ...(user ? { reported_user: { connect: [user.documentId] } } : {}) },
    });
  } else {
    if (user) {
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { [field]: Math.max(0, (user[field] || 0) - 1) },
      });
    }
    await strapi.documents('api::report.report').update({
      documentId: result.documentId,
      data: { counted: false, reported_user: { set: [] } },
    });
  }
}

/** Moderations-Aktion → gemeldeten Beitrag/Kommentar direkt löschen. */
async function handleAction(result) {
  if (result.moderation_action !== 'delete_content' || result.content_deleted) return;

  // Verknüpften Inhalt nachladen (Relationen sind im result nicht enthalten).
  const full = await strapi.documents('api::report.report').findOne({
    documentId: result.documentId,
    populate: ['thread', 'comment'],
  });

  let deleted = false;
  if (full && full.thread && full.thread.documentId) {
    await strapi.documents('api::thread.thread').delete({ documentId: full.thread.documentId });
    deleted = true;
  } else if (full && full.comment && full.comment.documentId) {
    await strapi.documents('api::comment.comment').delete({ documentId: full.comment.documentId });
    deleted = true;
  }

  await strapi.documents('api::report.report').update({
    documentId: result.documentId,
    data: { content_deleted: deleted, moderation_action: 'none', status: 'resolved' },
  });
}

module.exports = {
  async afterUpdate(event) {
    const { result } = event;
    if (!result || processing.has(result.id)) return;

    processing.add(result.id);
    try {
      await handleVerdict(result);
      await handleAction(result);
    } catch (error) {
      strapi.log.error('[report.lifecycles] Verarbeitung fehlgeschlagen:');
      strapi.log.error(error);
    } finally {
      processing.delete(result.id);
    }
  },
};
