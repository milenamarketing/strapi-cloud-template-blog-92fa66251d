'use strict';

/**
 * Auth-Brücke-Controller: tauscht ein Base44-Token gegen einen Strapi-JWT.
 */

const { verifyBase44Token, findOrCreateUser } = require('../services/auth-base44');

module.exports = {
  async exchange(ctx) {
    // Token aus Authorization-Header (Bearer ...) oder Body lesen.
    const authHeader = ctx.request.header.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = bearer || (ctx.request.body && ctx.request.body.token);

    if (!token) {
      return ctx.badRequest('Kein Base44-Token übergeben.');
    }

    const base44User = await verifyBase44Token(token);
    if (!base44User) {
      return ctx.unauthorized('Base44-Token ungültig oder nicht verifizierbar.');
    }

    const user = await findOrCreateUser(base44User);
    if (user.blocked) {
      return ctx.forbidden('Dieser Account ist gesperrt.');
    }

    // Strapi-JWT für die weiteren Community-Calls ausstellen.
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    ctx.body = {
      jwt,
      user: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        base44_id: user.base44_id,
      },
    };
  },
};
