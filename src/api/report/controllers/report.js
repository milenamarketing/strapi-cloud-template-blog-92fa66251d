'use strict';

/**
 * report controller
 *
 * create: erzeugt eine Meldung. Melderin, Status, Typ (thread/comment) und ein
 * Kontext-Text (Auszug des gemeldeten Inhalts) werden serverseitig gesetzt, damit
 * die Moderation im Strapi-Admin alles auf einen Blick sieht.
 */

const { createCoreController } = require('@strapi/strapi').factories;

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::report.report', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { reason, details, thread, comment } = ctx.request.body.data || {};

    // Typ + Kontext-Text + Autor des gemeldeten Inhalts ableiten.
    let targetType = null;
    let contextText = null;
    let authorId = null; // numerische User-ID des gemeldeten Autors (für Zähler)
    let authorDocId = null; // documentId des Autors (für die Relation reported_user)
    if (thread) {
      targetType = 'thread';
      const t = await strapi.documents('api::thread.thread').findOne({
        documentId: thread,
        populate: ['author'],
      });
      if (t) {
        contextText = `${t.title || ''} — ${t.content || ''}`.slice(0, 1000);
        authorId = t.author && t.author.id;
        authorDocId = t.author && t.author.documentId;
      }
    } else if (comment) {
      targetType = 'comment';
      const c = await strapi.documents('api::comment.comment').findOne({
        documentId: comment,
        populate: ['author'],
      });
      if (c) {
        contextText = (c.content || '').slice(0, 1000);
        authorId = c.author && c.author.id;
        authorDocId = c.author && c.author.documentId;
      }
    }

    const entity = await strapi.documents('api::report.report').create({
      data: {
        reason: reason || 'other',
        details,
        target_type: targetType,
        context_text: contextText,
        status: 'open',
        reporter_base44_id: user.base44_id || String(user.id),
        reporter_name: displayNameOf(user),
        ...(thread ? { thread: { connect: [thread] } } : {}),
        ...(comment ? { comment: { connect: [comment] } } : {}),
        ...(authorDocId ? { reported_user: { connect: [authorDocId] } } : {}),
      },
    });

    // Reporting-Zähler des gemeldeten Autors erhöhen (rein informativ für den SuperAdmin).
    if (authorId) {
      const field = targetType === 'comment' ? 'reporting_count_comments' : 'reporting_count_posts';
      try {
        const author = await strapi.db
          .query('plugin::users-permissions.user')
          .findOne({ where: { id: authorId } });
        if (author) {
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: authorId },
            data: { [field]: (author[field] || 0) + 1 },
          });
        }
      } catch (error) {
        strapi.log.error('[report] Reporting-Zähler konnte nicht erhöht werden:');
        strapi.log.error(error);
      }
    }

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
