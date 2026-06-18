'use strict';

/**
 * report controller
 *
 * create: erzeugt eine Meldung. Melderin wird serverseitig gesetzt; Status = open.
 * Reports sind nicht öffentlich lesbar – Review erfolgt durch Moderation/Admin.
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

    const entity = await strapi.documents('api::report.report').create({
      data: {
        reason: reason || 'other',
        details,
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
