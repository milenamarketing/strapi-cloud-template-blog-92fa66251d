'use strict';

/**
 * Report-Lifecycles.
 *
 * Steuert, ob eine Meldung gegen den gemeldeten Nutzer "zählt":
 * - verdict = 'justified'  → Meldung an User-Profil verknüpfen (reported_user) + Reporting-Zähler +1
 * - verdict != 'justified' → Verknüpfung lösen + Zähler -1 (sofern vorher gezählt)
 *
 * Das interne Flag `counted` macht den Vorgang idempotent (kein Doppelt-Zählen).
 * Ein In-Memory-Lock verhindert Rekursion durch das eigene Report-Update.
 */

const processing = new Set();

module.exports = {
  async afterUpdate(event) {
    const { result } = event;
    if (!result || processing.has(result.id)) return;

    const desiredCounted = result.verdict === 'justified';
    if (!!result.counted === desiredCounted) return; // nichts zu tun

    processing.add(result.id);
    try {
      const field =
        result.target_type === 'comment' ? 'reporting_count_comments' : 'reporting_count_posts';

      // Gemeldeten Nutzer über die denormalisierte base44_id finden.
      let user = null;
      if (result.reported_user_base44_id) {
        user = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({ where: { base44_id: result.reported_user_base44_id } });
      }

      if (desiredCounted) {
        if (user) {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: { [field]: (user[field] || 0) + 1 },
          });
        }
        await strapi.db.query('api::report.report').update({
          where: { id: result.id },
          data: { counted: true, ...(user ? { reported_user: user.id } : {}) },
        });
      } else {
        if (user) {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: { [field]: Math.max(0, (user[field] || 0) - 1) },
          });
        }
        await strapi.db.query('api::report.report').update({
          where: { id: result.id },
          data: { counted: false, reported_user: null },
        });
      }
    } catch (error) {
      strapi.log.error('[report.lifecycles] Verdict-Verarbeitung fehlgeschlagen:');
      strapi.log.error(error);
    } finally {
      processing.delete(result.id);
    }
  },
};
