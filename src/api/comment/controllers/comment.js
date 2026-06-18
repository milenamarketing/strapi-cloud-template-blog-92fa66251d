'use strict';

/**
 * comment controller
 *
 * Beim Erstellen wird der Autor SERVERSEITIG aus dem eingeloggten Nutzer gesetzt.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::comment.comment', () => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const data = ctx.request.body.data || {};
    ctx.request.body.data = { ...data, author: user.id };

    return await super.create(ctx);
  },
}));
