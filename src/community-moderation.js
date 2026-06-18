'use strict';

/**
 * Gemeinsame Moderations-Helfer für Community-Controller.
 */

/** Ist die Nutzerin Moderatorin/Admin? (Rolle ggf. nachladen.) */
async function isModerator(user) {
  if (!user) return false;
  let roleType = user.role && user.role.type;
  if (!roleType) {
    const full = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id }, populate: ['role'] });
    roleType = full && full.role && full.role.type;
  }
  return roleType === 'moderator' || roleType === 'admin';
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

module.exports = { isModerator, canModify };
