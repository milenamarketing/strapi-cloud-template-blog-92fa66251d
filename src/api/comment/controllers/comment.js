'use strict';

/**
 * comment controller
 *
 * Erstellen über den Document-Service mit Whitelist: nur content/thread aus dem
 * Request. Autor serverseitig gesetzt (Relation + denormalisierter author_name).
 */

const { createCoreController } = require('@strapi/strapi').factories;

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { content, thread } = ctx.request.body.data || {};

    const entity = await strapi.documents('api::comment.comment').create({
      data: {
        content,
        thread,
        author_name: displayNameOf(user),
        author: { connect: [user.documentId] },
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
