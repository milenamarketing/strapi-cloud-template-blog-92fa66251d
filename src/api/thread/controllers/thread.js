'use strict';

/**
 * thread controller
 *
 * - create: Whitelist (title/content/category), Autor + author_name serverseitig.
 * - toggleLike: schaltet das Like der eingeloggten Nutzerin für einen Thread um
 *   (idempotent, kein Doppel-Like) und hält likes_count aktuell.
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

  async toggleLike(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const threadDocId = ctx.params.id;
    const thread = await strapi.documents('api::thread.thread').findOne({ documentId: threadDocId });
    if (!thread) return ctx.notFound('Thema nicht gefunden.');

    const existing = await strapi.documents('api::like.like').findMany({
      filters: { thread: { documentId: threadDocId }, user: { id: user.id } },
      limit: 1,
    });

    let liked;
    if (existing.length > 0) {
      await strapi.documents('api::like.like').delete({ documentId: existing[0].documentId });
      liked = false;
    } else {
      await strapi.documents('api::like.like').create({
        data: { thread: { connect: [threadDocId] }, user: { connect: [user.documentId] } },
      });
      liked = true;
    }

    // likes_count robust neu zählen und am Thread speichern.
    const likesCount = await strapi.db
      .query('api::like.like')
      .count({ where: { thread: { documentId: threadDocId } } });
    await strapi.documents('api::thread.thread').update({
      documentId: threadDocId,
      data: { likes_count: likesCount },
    });

    ctx.body = { data: { liked, likes_count: likesCount } };
  },
}));
