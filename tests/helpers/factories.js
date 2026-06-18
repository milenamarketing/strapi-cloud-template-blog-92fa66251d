'use strict';

const { getStrapi } = require('./strapi');

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';

let seq = 0;
function uniq() {
  seq += 1;
  return `${Date.now().toString(36)}${seq}`;
}

async function roleId(type) {
  const role = await getStrapi().db.query(ROLE_UID).findOne({ where: { type } });
  return role ? role.id : null;
}

/**
 * Legt einen Test-Nutzer an (Default-Rolle authenticated). Optionen erlauben
 * Sperr-/Rollen-Szenarien. Gibt den vollständigen DB-Record (inkl. documentId) zurück.
 */
async function makeUser(opts = {}) {
  const strapi = getStrapi();
  const tag = uniq();
  const created = await strapi.db.query(USER_UID).create({
    data: {
      username: opts.username || `user_${tag}`,
      email: opts.email || `user_${tag}@test.local`,
      password: 'Test1234!',
      provider: 'base44',
      confirmed: true,
      blocked: opts.blocked || false,
      base44_id: opts.base44_id || `b44_${tag}`,
      display_name: opts.display_name || `User ${tag}`,
      role: await roleId(opts.role || 'authenticated'),
      is_banned: opts.is_banned || false,
      ban_type: opts.ban_type || null,
      ban_reason: opts.ban_reason || null,
      reporting_count_posts: opts.reporting_count_posts || 0,
      reporting_count_comments: opts.reporting_count_comments || 0,
    },
  });
  return created;
}

/** Stellt einen gültigen Strapi-JWT für den Nutzer aus (für Authorization: Bearer). */
function jwtFor(user) {
  return getStrapi().plugin('users-permissions').service('jwt').issue({ id: user.id });
}

/** Erstellt einen Thread direkt (umgeht den Controller) – für Report/Like/Lifecycle-Setups. */
async function makeThread(opts = {}) {
  const strapi = getStrapi();
  const author = opts.author || null;
  return strapi.documents('api::thread.thread').create({
    data: {
      title: opts.title || `Thread ${uniq()}`,
      content: opts.content || 'Inhalt',
      category: opts.category || 'Allgemein',
      comments_enabled: opts.comments_enabled === false ? false : true,
      pinned: opts.pinned || false,
      likes_count: opts.likes_count || 0,
      author_name: author ? author.display_name : 'Autor',
      author_base44_id: author ? author.base44_id : `b44_${uniq()}`,
      ...(author ? { author: { connect: [author.documentId] } } : {}),
    },
  });
}

/** Erstellt einen Kommentar direkt. */
async function makeComment(opts = {}) {
  const strapi = getStrapi();
  const author = opts.author || null;
  return strapi.documents('api::comment.comment').create({
    data: {
      content: opts.content || `Kommentar ${uniq()}`,
      ...(opts.threadId ? { thread: { connect: [opts.threadId] } } : {}),
      author_name: author ? author.display_name : 'Autor',
      author_base44_id: author ? author.base44_id : `b44_${uniq()}`,
      ...(author ? { author: { connect: [author.documentId] } } : {}),
    },
  });
}

/** Erstellt eine Meldung direkt (umgeht den Controller) – für Lifecycle-/Alert-Setups. */
async function makeReport(opts = {}) {
  const strapi = getStrapi();
  return strapi.documents('api::report.report').create({
    data: {
      reason: opts.reason || 'other',
      target_type: opts.target_type || 'thread',
      status: opts.status || 'open',
      verdict: opts.verdict || 'pending',
      counted: opts.counted || false,
      reporter_base44_id: opts.reporter_base44_id || `rep_${uniq()}`,
      reporter_name: opts.reporter_name || 'Melderin',
      reported_user_name: opts.reported_user_name || null,
      reported_user_base44_id: opts.reported_user_base44_id || null,
      ...(opts.threadId ? { thread: { connect: [opts.threadId] } } : {}),
      ...(opts.commentId ? { comment: { connect: [opts.commentId] } } : {}),
    },
  });
}

/** Löscht alle Einträge der angegebenen Content-Type-UIDs (Cleanup zwischen Tests). */
async function clear(...uids) {
  const strapi = getStrapi();
  for (const uid of uids) {
    const rows = await strapi.db.query(uid).findMany({ select: ['id'] });
    if (rows.length) {
      await strapi.db.query(uid).deleteMany({ where: { id: { $in: rows.map((r) => r.id) } } });
    }
  }
}

module.exports = { makeUser, jwtFor, makeThread, makeComment, makeReport, clear, roleId };
