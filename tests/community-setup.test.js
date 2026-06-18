'use strict';

const { setupStrapi, teardownStrapi, getStrapi } = require('./helpers/strapi');
const { makeUser, clear } = require('./helpers/factories');
const { setupCommunity } = require('../src/community-setup');
const cron = require('../config/cron');

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  delete process.env.SUPERADMIN_BASE44_IDS;
  await clear(USER_UID);
});

describe('setupCommunity (Bootstrap)', () => {
  it('legt die Community-Rollen an', async () => {
    const roles = await getStrapi().db.query(ROLE_UID).findMany({ select: ['type'] });
    const types = roles.map((r) => r.type);
    expect(types).toEqual(expect.arrayContaining(['authenticated', 'moderator', 'superadmin']));
  });

  it('ist idempotent (zweiter Lauf ändert die Rollenanzahl nicht)', async () => {
    const before = (await getStrapi().db.query(ROLE_UID).findMany({ select: ['id'] })).length;
    await setupCommunity();
    const after = (await getStrapi().db.query(ROLE_UID).findMany({ select: ['id'] })).length;
    expect(after).toBe(before);
  });

  it('promotet konfigurierte SUPERADMIN_BASE44_IDS', async () => {
    const user = await makeUser({ base44_id: 'b44-promote' });
    process.env.SUPERADMIN_BASE44_IDS = 'b44-promote';
    await setupCommunity();
    const full = await getStrapi().db.query(USER_UID).findOne({ where: { id: user.id }, populate: ['role'] });
    expect(full.role.type).toBe('superadmin');
  });
});

describe('Cron: dailyReportAlerts', () => {
  it('Task läuft ohne Fehler (ruft recomputeAllReportAlerts)', async () => {
    await expect(cron.dailyReportAlerts.task()).resolves.toBeUndefined();
    expect(cron.dailyReportAlerts.options.rule).toBe('0 3 * * *');
  });
});
