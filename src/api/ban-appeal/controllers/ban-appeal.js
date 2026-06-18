'use strict';

/**
 * ban-appeal controller
 *
 * create: ein gesperrter (oder beliebiger eingeloggter) Nutzer schreibt einen Einspruch.
 * User-Verknüpfung + denormalisierte Anzeigefelder werden serverseitig gesetzt, damit der
 * Einspruch im Strapi-Panel direkt am User-Profil (Relation) und in der Liste sichtbar ist.
 */

const { createCoreController } = require('@strapi/strapi').factories;

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::ban-appeal.ban-appeal', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { message } = ctx.request.body.data || {};

    const entity = await strapi.documents('api::ban-appeal.ban-appeal').create({
      data: {
        message: (message || '').slice(0, 2000),
        status: 'open',
        user_name: displayNameOf(user),
        user_base44_id: user.base44_id || String(user.id),
        ban_type_at_time: user.ban_type || null,
        user: { connect: [user.documentId] },
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
