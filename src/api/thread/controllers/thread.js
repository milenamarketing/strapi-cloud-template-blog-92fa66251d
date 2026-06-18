'use strict';

/**
 * thread controller
 *
 * Beim Erstellen wird der Autor SERVERSEITIG aus dem eingeloggten Nutzer gesetzt
 * (nicht aus dem Request-Body) – verhindert, dass jemand fremde Autorschaft angibt.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::thread.thread', () => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const data = ctx.request.body.data || {};
    ctx.request.body.data = { ...data, author: user.id, likes_count: 0 };

    return await super.create(ctx);
  },
}));
