'use strict';

/**
 * comment controller
 *
 * - create: Whitelist (content/thread/parent/images), Autor serverseitig.
 * - update/delete: nur Autorin oder Moderatorin.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { canModify } = require('../../../community-moderation');

function displayNameOf(user) {
  return user.display_name || user.username || 'Anonym';
}

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const { content, thread, parent, images } = ctx.request.body.data || {};

    const entity = await strapi.documents('api::comment.comment').create({
      data: {
        content,
        thread,
        author_name: displayNameOf(user),
        author_base44_id: user.base44_id || String(user.id),
        author: { connect: [user.documentId] },
        ...(parent ? { parent: { connect: [parent] } } : {}),
        ...(Array.isArray(images) && images.length ? { images } : {}),
      },
    });

    const sanitized = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitized);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');
    const comment = await strapi.documents('api::comment.comment').findOne({
      documentId: ctx.params.id,
      populate: ['author'],
    });
    if (!comment) return ctx.notFound();
    if (!(await canModify(user, comment))) return ctx.forbidden('Keine Berechtigung.');
    return super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');
    const comment = await strapi.documents('api::comment.comment').findOne({
      documentId: ctx.params.id,
      populate: ['author'],
    });
    if (!comment) return ctx.notFound();
    if (!(await canModify(user, comment))) return ctx.forbidden('Keine Berechtigung.');
    return super.delete(ctx);
  },
}));
