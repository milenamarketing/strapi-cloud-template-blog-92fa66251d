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

// Schwelle: mehr als so viele bestätigte Meldungen in 7 Tagen → Warn-Markierung.
const ALERT_THRESHOLD = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aktualisiert das Warn-Feld `report_alert` eines Nutzers (für die Listen-Spalte):
 * "⚠️", wenn er in den letzten 7 Tagen > ALERT_THRESHOLD bestätigte (justified) Meldungen
 * erhalten hat, sonst leer. Zählt über das denormalisierte `reported_user_base44_id`.
 */
async function recomputeReportAlert(base44Id) {
  if (!base44Id) return;
  const since = new Date(Date.now() - SEVEN_DAYS_MS);
  const count = await strapi.db.query('api::report.report').count({
    where: { reported_user_base44_id: base44Id, verdict: 'justified', createdAt: { $gte: since } },
  });
  const user = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({ where: { base44_id: base44Id } });
  if (!user) return;
  const alert = count > ALERT_THRESHOLD ? '⚠️' : '';
  if ((user.report_alert || '') !== alert) {
    await strapi.db
      .query('plugin::users-permissions.user')
      .update({ where: { id: user.id }, data: { report_alert: alert } });
  }
}

/** Recompute für alle Nutzer mit base44_id (für den täglichen Cron / Fenster-Ablauf). */
async function recomputeAllReportAlerts() {
  const users = await strapi.db
    .query('plugin::users-permissions.user')
    .findMany({ where: { base44_id: { $notNull: true } }, select: ['id', 'base44_id'] });
  for (const u of users) await recomputeReportAlert(u.base44_id);
}

module.exports = {
  isModerator,
  isSuperAdmin,
  roleTypeOf,
  banBlocks,
  canModify,
  avatarUrlOf,
  recomputeReportAlert,
  recomputeAllReportAlerts,
};
