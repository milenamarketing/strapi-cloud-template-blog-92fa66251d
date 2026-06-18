'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');
const request = require('supertest');

let instance;

const DB_FILE = path.join(__dirname, '..', '..', process.env.DATABASE_FILENAME || '.tmp/test.db');

/**
 * Bootet EINE Strapi-Testinstanz (idempotent). Der Bootstrap läuft dabei mit und
 * legt über `setupCommunity()` Rollen + Permissions automatisch an.
 */
async function setupStrapi() {
  if (!instance) {
    instance = await createStrapi().load();
    await instance.server.mount();
  }
  return instance;
}

/** Fährt die Instanz herunter und löscht die Wegwerf-DB. */
async function teardownStrapi() {
  if (instance) {
    await instance.destroy();
    instance = undefined;
  }
  for (const f of [DB_FILE, `${DB_FILE}-journal`, `${DB_FILE}-shm`, `${DB_FILE}-wal`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

/** supertest-Client gegen den HTTP-Server der Instanz. */
function http() {
  return request(instance.server.httpServer);
}

module.exports = { setupStrapi, teardownStrapi, http, getStrapi: () => instance };
