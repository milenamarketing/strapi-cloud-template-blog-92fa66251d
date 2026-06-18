'use strict';

/**
 * Gemeinsame Moderations-Helfer für Community-Controller.
 */

/** Rollentyp der Nutzerin ermitteln (Rolle ggf. nachladen). */
async function roleTypeOf(user) {
  if (!user) return null;
  let roleType = user.role && user.role.type;
  if (!roleType) {
    const full = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id }, populate: ['role'] });
    roleType = full && full.role && full.role.type;
  }
  return roleType || null;
}

/** Ist die Nutzerin Moderatorin/Admin/SuperAdmin? (superadmin zählt mit.) */
async function isModerator(user) {
  if (!user) return false;
  const roleType = await roleTypeOf(user);
  return roleType === 'moderator' || roleType === 'admin' || roleType === 'superadmin';
}

/** Ist die Nutzerin SuperAdmin (LunaCycle-Team)? */
async function isSuperAdmin(user) {
  if (!user) return false;
  const roleType = await roleTypeOf(user);
  return roleType === 'superadmin' || roleType === 'admin';
}

/**
 * Prüft, ob die Nutzerin den Eintrag ändern/löschen darf (Autorin ODER Moderatorin).
 * @returns {Promise<boolean>}
 */
async function canModify(user, entityWithAuthor) {
  if (!user) return false;
  const authorId = entityWithAuthor && entityWithAuthor.author && entityWithAuthor.author.id;
  if (authorId && authorId === user.id) return true;
  return isModerator(user);
}

/**
 * Prüft, ob eine Sperre die Aktion blockiert. Spiegelt die Frontend-Logik (community-ban.js).
 * @param {object} user  ctx.state.user (trägt is_banned/ban_type als Skalarfelder)
 * @param {'post'|'comment'} action
 * @returns {boolean} true = blockiert
 */
function banBlocks(user, action) {
  if (!user || !user.is_banned) return false;
  const type = user.ban_type;
  if (type === 'full_ban') return true;
  if (type === 'comments_only') return action === 'comment';
  if (type === 'posts_only') return action === 'post';
  return false;
}

/** Liefert die Avatar-URL der Nutzerin (oder null) – für denormalisierte Anzeige. */
async function avatarUrlOf(user) {
  if (!user) return null;
  const full = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({ where: { id: user.id }, populate: ['avatar'] });
  return (full && full.avatar && full.avatar.url) || null;
}

module.exports = { isModerator, isSuperAdmin, roleTypeOf, banBlocks, canModify, avatarUrlOf };
