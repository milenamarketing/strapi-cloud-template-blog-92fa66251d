'use strict';

/**
 * thread controller
 *
 * Erstellen über den Document-Service mit Whitelist: nur title/content/category
 * aus dem Request. Autor wird SERVERSEITIG gesetzt: als Relation (für Besitz/
 * Moderation) UND als denormalisierter author_name (für die öffentliche Anzeige,
 * da Strapi die User-Relation aus öffentlichen Antworten heraussanitisiert).
 */

const { createCoreController } = require('@strapi/strapi').factories;

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::thread.thread', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { title, content, category } = ctx.request.body.data || {};

    const entity = await strapi.documents('api::thread.thread').create({
      data: {
        title,
        content,
        category,
        likes_count: 0,
        author_name: displayNameOf(user),
        author: { connect: [user.documentId] },
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },
}));
