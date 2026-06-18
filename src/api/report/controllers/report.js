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

    // Typ + Kontext-Text aus dem gemeldeten Inhalt ableiten.
    let targetType = null;
    let contextText = null;
    if (thread) {
      targetType = 'thread';
      const t = await strapi.documents('api::thread.thread').findOne({ documentId: thread });
      if (t) contextText = `${t.title || ''} — ${t.content || ''}`.slice(0, 1000);
    } else if (comment) {
      targetType = 'comment';
      const c = await strapi.documents('api::comment.comment').findOne({ documentId: comment });
      if (c) contextText = (c.content || '').slice(0, 1000);
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
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
