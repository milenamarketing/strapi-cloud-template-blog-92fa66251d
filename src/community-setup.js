'use strict';

/**
 * Idempotente Einrichtung der Community-Rollen & -Berechtigungen.
 *
 * Läuft bei JEDEM Bootstrap (lokal + Strapi Cloud). Da Rollen/Permissions des
 * Users-Permissions-Plugins in der Datenbank liegen (nicht in den schema.json-Dateien),
 * werden sie hier per Code reproduzierbar gesetzt – so sind sie in jeder Umgebung gleich.
 *
 * - public        : darf Threads/Kommentare nur lesen
 * - authenticated : darf Threads/Kommentare/Likes erstellen + eigene bearbeiten/löschen
 * - moderator     : wie authenticated; Rolle wird angelegt, feinere Moderationsrechte folgen
 */

// action-Format von Strapi: `api::<api>.<controller>.<action>`
const PUBLIC_PERMISSIONS = {
  thread: ['find', 'findOne'],
  comment: ['find', 'findOne'],
};

const AUTHENTICATED_PERMISSIONS = {
  thread: ['find', 'findOne', 'create', 'update', 'delete', 'toggleLike'],
  comment: ['find', 'findOne', 'create', 'update', 'delete'],
  like: ['find', 'findOne', 'create', 'delete'],
};

/** Findet eine Rolle anhand ihres Typs (z. B. "public", "authenticated"). */
async function findRoleByType(type) {
  return strapi.query('plugin::users-permissions.role').findOne({ where: { type } });
}

/** Setzt fehlende Permissions für eine Rolle (idempotent – legt nur an, was noch fehlt). */
async function ensurePermissions(roleType, permissionMap) {
  const role = await findRoleByType(roleType);
  if (!role) {
    strapi.log.warn(`[community-setup] Rolle "${roleType}" nicht gefunden – übersprungen.`);
    return;
  }

  for (const [api, actions] of Object.entries(permissionMap)) {
    for (const action of actions) {
      const fullAction = `api::${api}.${api}.${action}`;
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: fullAction, role: role.id },
      });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action: fullAction, role: role.id },
        });
        strapi.log.info(`[community-setup] Permission gesetzt: ${roleType} → ${fullAction}`);
      }
    }
  }
}

/** Legt die Moderator-Rolle an, falls sie noch nicht existiert. */
async function ensureModeratorRole() {
  const existing = await findRoleByType('moderator');
  if (existing) return existing;

  const role = await strapi.query('plugin::users-permissions.role').create({
    data: {
      name: 'Moderator',
      description: 'Kann fremde Beiträge moderieren (löschen/bearbeiten).',
      type: 'moderator',
    },
  });
  strapi.log.info('[community-setup] Rolle "Moderator" angelegt.');
  return role;
}

async function setupCommunity() {
  try {
    await ensurePermissions('public', PUBLIC_PERMISSIONS);
    await ensurePermissions('authenticated', AUTHENTICATED_PERMISSIONS);

    // Moderator-Rolle bekommt vorerst dieselben Rechte wie authenticated (Feinheiten später).
    await ensureModeratorRole();
    await ensurePermissions('moderator', AUTHENTICATED_PERMISSIONS);

    strapi.log.info('[community-setup] Community-Rollen & -Rechte sichergestellt.');
  } catch (error) {
    strapi.log.error('[community-setup] Fehler beim Einrichten der Community-Rollen:');
    strapi.log.error(error);
  }
}

module.exports = { setupCommunity };
