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
  report: ['create'],
  'ban-appeal': ['create'],
  'auth-base44': ['updateAvatar'],
};

// Moderatorinnen/SuperAdmins dürfen zusätzlich Meldungen + Einsprüche einsehen/bearbeiten.
const MODERATOR_EXTRA_PERMISSIONS = {
  report: ['find', 'findOne', 'update', 'delete'],
  'ban-appeal': ['find', 'findOne', 'update', 'delete'],
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

/** Setzt eine einzelne Permission (volle action-ID, z. B. Plugin-Action) für eine Rolle. */
async function ensureRawPermission(roleType, fullAction) {
  const role = await findRoleByType(roleType);
  if (!role) return;
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

/** Legt die SuperAdmin-Rolle an (LunaCycle-Team), falls noch nicht vorhanden. */
async function ensureSuperadminRole() {
  const existing = await findRoleByType('superadmin');
  if (existing) return existing;

  const role = await strapi.query('plugin::users-permissions.role').create({
    data: {
      name: 'SuperAdmin',
      description: 'LunaCycle-Team: volle Community-Kontrolle (Sperren, Löschen, Einsprüche).',
      type: 'superadmin',
    },
  });
  strapi.log.info('[community-setup] Rolle "SuperAdmin" angelegt.');
  return role;
}

/**
 * Promotet feste Base44-IDs (Env SUPERADMIN_BASE44_IDS, comma-separated) zur SuperAdmin-Rolle.
 * Reproduzierbar bei jedem Bootstrap; idempotent (setzt nur, wenn Rolle abweicht).
 */
async function promoteSuperAdmins() {
  const raw = process.env.SUPERADMIN_BASE44_IDS || '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const role = await findRoleByType('superadmin');
  if (!role) return;

  for (const base44Id of ids) {
    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { base44_id: base44Id }, populate: ['role'] });
    if (!user) continue; // noch nicht eingeloggt → wird beim Login promotet (auth-base44)
    if (user.role && user.role.type === 'superadmin') continue;
    await strapi
      .query('plugin::users-permissions.user')
      .update({ where: { id: user.id }, data: { role: role.id } });
    strapi.log.info(`[community-setup] SuperAdmin gesetzt: base44_id=${base44Id}`);
  }
}

async function setupCommunity() {
  try {
    await ensurePermissions('public', PUBLIC_PERMISSIONS);
    await ensurePermissions('authenticated', AUTHENTICATED_PERMISSIONS);

    // Moderator-Rolle bekommt vorerst dieselben Rechte wie authenticated (Feinheiten später).
    await ensureModeratorRole();
    await ensurePermissions('moderator', AUTHENTICATED_PERMISSIONS);
    await ensurePermissions('moderator', MODERATOR_EXTRA_PERMISSIONS);

    // SuperAdmin-Rolle (LunaCycle): alle Member-Rechte + Moderations-/Einspruch-Einsicht.
    await ensureSuperadminRole();
    await ensurePermissions('superadmin', AUTHENTICATED_PERMISSIONS);
    await ensurePermissions('superadmin', MODERATOR_EXTRA_PERMISSIONS);

    // Bild-Upload für Kommentare: eingeloggte Nutzerinnen + Moderatoren + SuperAdmin.
    await ensureRawPermission('authenticated', 'plugin::upload.content-api.upload');
    await ensureRawPermission('moderator', 'plugin::upload.content-api.upload');
    await ensureRawPermission('superadmin', 'plugin::upload.content-api.upload');

    // Feste LunaCycle-Accounts zur SuperAdmin-Rolle promoten (Env-gesteuert).
    await promoteSuperAdmins();

    strapi.log.info('[community-setup] Community-Rollen & -Rechte sichergestellt.');
  } catch (error) {
    strapi.log.error('[community-setup] Fehler beim Einrichten der Community-Rollen:');
    strapi.log.error(error);
  }
}

module.exports = { setupCommunity };
