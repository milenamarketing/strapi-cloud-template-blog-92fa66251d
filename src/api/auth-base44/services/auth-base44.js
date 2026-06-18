'use strict';

/**
 * Auth-Brücke Base44 -> Strapi.
 *
 * Verifiziert ein Base44-App-Token und legt – falls nötig – automatisch einen
 * passenden Strapi-User an (Just-in-Time-Provisioning). So gibt es nur EINEN Login
 * (Base44); in Strapi entsteht trotzdem ein echter Nutzer, fest verknüpft über `base44_id`.
 */

const VERIFY_TIMEOUT_MS = 8000;

/**
 * Verifiziert das Base44-Token, indem der Base44-"me"-Endpoint mit dem Token
 * aufgerufen wird. Gibt das Base44-User-Objekt (mit id/email) zurück, sonst null.
 *
 * Die URL kommt aus der Env-Variable BASE44_ME_URL (z. B.
 * https://luna-cycle-...base44.app/api/auth/me). Sie MUSS vor dem Go-Live gesetzt/
 * bestätigt werden – ohne sie wird die Verifikation abgelehnt (kein unsicherer Fallback).
 */
async function verifyBase44Token(token) {
  const meUrl = process.env.BASE44_ME_URL;
  if (!meUrl) {
    strapi.log.error(
      '[auth-base44] BASE44_ME_URL ist nicht gesetzt – Token-Verifikation nicht möglich.'
    );
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = await res.json();
    // Base44 kann den User direkt oder unter .user/.data liefern – defensiv auslesen.
    const user = data?.user || data?.data || data;
    if (!user || (!user.id && !user.email)) return null;
    return user;
  } catch (error) {
    strapi.log.error('[auth-base44] Fehler bei der Base44-Token-Verifikation:');
    strapi.log.error(error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Findet den Strapi-User zur Base44-Identität oder legt ihn an (Just-in-Time).
 * Reihenfolge: 1) über base44_id  2) über E-Mail (verknüpfen)  3) neu anlegen.
 */
async function findOrCreateUser(base44User) {
  const base44Id = String(base44User.id || base44User.email);
  const email = base44User.email || `${base44Id}@base44.local`;
  const userQuery = strapi.query('plugin::users-permissions.user');

  // 1) bereits verknüpft?
  const linked = await userQuery.findOne({ where: { base44_id: base44Id } });
  if (linked) return linked;

  // 2) gleiche E-Mail vorhanden -> verknüpfen
  const byEmail = await userQuery.findOne({ where: { email } });
  if (byEmail) {
    return userQuery.update({ where: { id: byEmail.id }, data: { base44_id: base44Id } });
  }

  // 3) neu anlegen mit Rolle "authenticated"
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  const displayName = base44User.full_name || base44User.name || email.split('@')[0];
  // Username muss eindeutig + min. 3 Zeichen sein – mit base44Id-Suffix absichern.
  const username = `${displayName}-${base44Id.slice(0, 6)}`.slice(0, 50);

  return userQuery.create({
    data: {
      base44_id: base44Id,
      email,
      username,
      display_name: displayName,
      provider: 'base44',
      confirmed: true,
      blocked: false,
      role: authenticatedRole ? authenticatedRole.id : null,
    },
  });
}

module.exports = { verifyBase44Token, findOrCreateUser };
