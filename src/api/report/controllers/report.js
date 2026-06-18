'use strict';

/**
 * report controller
 *
 * create: erzeugt eine Meldung. Melderin, Typ (thread/comment), Kontext-Text (Auszug
 * des gemeldeten Inhalts) und der gemeldete Autor (denormalisiert) werden serverseitig
 * gesetzt, damit die Moderation im Strapi-Admin alles auf einen Blick sieht.
 *
 * WICHTIG: Eine Meldung zählt NICHT automatisch gegen den gemeldeten Nutzer. Erst wenn
 * der SuperAdmin sie auf `verdict = justified` setzt, wird sie an dessen Profil verknüpft
 * (`reported_user`) und der Reporting-Zähler erhöht (siehe lifecycles.js). So führen
 * unberechtigte Meldungen nicht zu Sperren.
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

    // Typ + Kontext-Text + Autor des gemeldeten Inhalts ableiten (denormalisiert).
    let targetType = null;
    let contextText = null;
    let reportedName = null;
    let reportedBase44Id = null;
    const authorOf = (entity) => entity && entity.author;
    if (thread) {
      targetType = 'thread';
      const t = await strapi.documents('api::thread.thread').findOne({
        documentId: thread,
        populate: ['author'],
      });
      if (t) {
        contextText = `${t.title || ''} — ${t.content || ''}`.slice(0, 1000);
        const a = authorOf(t);
        if (a) { reportedName = displayNameOf(a); reportedBase44Id = a.base44_id || String(a.id); }
      }
    } else if (comment) {
      targetType = 'comment';
      const c = await strapi.documents('api::comment.comment').findOne({
        documentId: comment,
        populate: ['author'],
      });
      if (c) {
        contextText = (c.content || '').slice(0, 1000);
        const a = authorOf(c);
        if (a) { reportedName = displayNameOf(a); reportedBase44Id = a.base44_id || String(a.id); }
      }
    }

    const entity = await strapi.documents('api::report.report').create({
      data: {
        reason: reason || 'other',
        details,
        target_type: targetType,
        context_text: contextText,
        status: 'open',
        verdict: 'pending',
        counted: false,
        reporter_base44_id: user.base44_id || String(user.id),
        reporter_name: displayNameOf(user),
        // Gemeldeter Autor denormalisiert (im Report immer sichtbar, auch vor der Prüfung).
        reported_user_name: reportedName,
        reported_user_base44_id: reportedBase44Id,
        ...(thread ? { thread: { connect: [thread] } } : {}),
        ...(comment ? { comment: { connect: [comment] } } : {}),
        // KEIN reported_user-Connect und KEIN Zähler hier – erst bei verdict=justified.
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
