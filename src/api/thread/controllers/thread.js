'use strict';

/**
 * thread controller
 *
 * - create: Whitelist (title/content/category/images), Autor + author_name serverseitig.
 * - update/delete: nur Autorin oder Moderatorin.
 * - toggleLike: Like umschalten (idempotent), pflegt likes_count.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { canModify, avatarUrlOf } = require('../../../community-moderation');

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::thread.thread', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { title, content, category, images } = ctx.request.body.data || {};

    const entity = await strapi.documents('api::thread.thread').create({
      data: {
        title,
        content,
        category,
        likes_count: 0,
        author_name: displayNameOf(user),
        author_base44_id: user.base44_id || String(user.id),
        author_avatar: await avatarUrlOf(user),
        author: { connect: [user.documentId] },
        ...(Array.isArray(images) && images.length ? { images } : {}),
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');
    const thread = await strapi.documents('api::thread.thread').findOne({
      documentId: ctx.params.id,
      populate: ['author'],
    });
    if (!thread) return ctx.notFound();
    if (!(await canModify(user, thread))) return ctx.forbidden('Keine Berechtigung.');
    return super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');
    const thread = await strapi.documents('api::thread.thread').findOne({
      documentId: ctx.params.id,
      populate: ['author'],
    });
    if (!thread) return ctx.notFound();
    if (!(await canModify(user, thread))) return ctx.forbidden('Keine Berechtigung.');
    return super.delete(ctx);
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
        data: {
          thread: { connect: [threadDocId] },
          user: { connect: [user.documentId] },
          user_base44_id: user.base44_id || String(user.id),
        },
      });
      liked = true;
    }

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
