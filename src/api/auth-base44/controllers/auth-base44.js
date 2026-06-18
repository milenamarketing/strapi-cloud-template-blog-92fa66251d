'use strict';

/**
 * Auth-Brücke-Controller: tauscht ein Base44-Token gegen einen Strapi-JWT.
 */

const { verifyBase44Token, findOrCreateUser, ensureSuperAdminRole } = require('../services/auth-base44');

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

    // Feste LunaCycle-Accounts ggf. zur SuperAdmin-Rolle promoten (Env-gesteuert).
    await ensureSuperAdminRole(user);

    // Strapi-JWT für die weiteren Community-Calls ausstellen.
    const jwt = strapi.plugin('users-permissions').service('jwt').issue({ id: user.id });

    // Rolle + Avatar laden (Frontend erkennt Moderatorinnen/SuperAdmin + zeigt Profilbild).
    const fullUser = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id }, populate: ['role', 'avatar'] });
    const role = (fullUser && fullUser.role && fullUser.role.type) || 'authenticated';
    const avatar = (fullUser && fullUser.avatar && fullUser.avatar.url) || null;

    ctx.body = {
      jwt,
      user: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        base44_id: user.base44_id,
        role,
        avatar,
        // Sperr-Status (Frontend setzt Sperre um + zeigt Sperr-Modal).
        is_banned: !!fullUser.is_banned,
        ban_type: fullUser.ban_type || null,
        ban_reason: fullUser.ban_reason || null,
      },
    };
  },

  // Eigenes Profilbild setzen (avatar = Upload-File-ID) oder entfernen (null).
  async updateAvatar(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Login erforderlich.');

    const body = (ctx.request.body && (ctx.request.body.data || ctx.request.body)) || {};
    const avatarId = body.avatar || null;

    await strapi.db
      .query('plugin::users-permissions.user')
      .update({ where: { id: user.id }, data: { avatar: avatarId } });

    const full = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id }, populate: ['avatar'] });

    ctx.body = { data: { avatar: (full && full.avatar && full.avatar.url) || null } };
  },
};
