'use strict';

const { setupStrapi, teardownStrapi, http, getStrapi } = require('./helpers/strapi');
const { makeUser, clear, roleId } = require('./helpers/factories');
const svc = require('../src/api/auth-base44/services/auth-base44');

const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

const ORIG_FETCH = global.fetch;
afterEach(async () => {
  global.fetch = ORIG_FETCH;
  delete process.env.BASE44_ME_URL;
  delete process.env.SUPERADMIN_BASE44_IDS;
  await clear(USER_UID);
});

const mockFetchUser = (user, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => user });
};

describe('Service: verifyBase44Token', () => {
  it('ohne BASE44_ME_URL → null (kein unsicherer Fallback)', async () => {
    delete process.env.BASE44_ME_URL;
    expect(await svc.verifyBase44Token('tok')).toBeNull();
  });

  it('mit URL + erfolgreichem Fetch → User-Objekt', async () => {
    process.env.BASE44_ME_URL = 'http://base44.local/me';
    mockFetchUser({ id: 'b44-1', email: 'a@b.de' });
    const u = await svc.verifyBase44Token('tok');
    expect(u).toMatchObject({ id: 'b44-1', email: 'a@b.de' });
  });

  it('Fetch nicht ok → null', async () => {
    process.env.BASE44_ME_URL = 'http://base44.local/me';
    mockFetchUser({}, false);
    expect(await svc.verifyBase44Token('tok')).toBeNull();
  });
});

describe('Service: findOrCreateUser (JIT)', () => {
  it('legt neuen Nutzer mit Rolle authenticated an und ist idempotent', async () => {
    const first = await svc.findOrCreateUser({ id: 'b44-new', email: 'new@x.de', full_name: 'Neu' });
    expect(first.base44_id).toBe('b44-new');
    const second = await svc.findOrCreateUser({ id: 'b44-new', email: 'new@x.de' });
    expect(second.id).toBe(first.id); // kein Duplikat
  });

  it('verknüpft per E-Mail einen bestehenden Account', async () => {
    await getStrapi().db.query(USER_UID).create({
      data: { username: 'mail_link', email: 'link@x.de', password: 'Test1234!', confirmed: true, role: await roleId('authenticated') },
    });
    const linked = await svc.findOrCreateUser({ id: 'b44-link', email: 'link@x.de' });
    expect(linked.base44_id).toBe('b44-link');
  });
});

describe('Service: ensureSuperAdminRole', () => {
  it('promotet konfigurierte Base44-ID, lässt andere unberührt', async () => {
    const sa = await makeUser({ base44_id: 'b44-sa' });
    const normal = await makeUser({ base44_id: 'b44-normal' });
    process.env.SUPERADMIN_BASE44_IDS = 'b44-sa';

    await svc.ensureSuperAdminRole(sa);
    await svc.ensureSuperAdminRole(normal);

    const saFull = await getStrapi().db.query(USER_UID).findOne({ where: { id: sa.id }, populate: ['role'] });
    const nFull = await getStrapi().db.query(USER_UID).findOne({ where: { id: normal.id }, populate: ['role'] });
    expect(saFull.role.type).toBe('superadmin');
    expect(nFull.role.type).toBe('authenticated');
  });
});

describe('Controller: POST /api/auth/base44 (exchange)', () => {
  it('ohne Token → 400', async () => {
    const res = await http().post('/api/auth/base44').send({});
    expect(res.status).toBe(400);
  });

  it('ungültiges Token → 401', async () => {
    process.env.BASE44_ME_URL = 'http://base44.local/me';
    mockFetchUser({}, false);
    const res = await http().post('/api/auth/base44').send({ token: 'bad' });
    expect(res.status).toBe(401);
  });

  it('gültiges Token → JWT + User mit Sperr-Feldern', async () => {
    process.env.BASE44_ME_URL = 'http://base44.local/me';
    mockFetchUser({ id: 'b44-ok', email: 'ok@x.de', full_name: 'Okay' });
    const res = await http().post('/api/auth/base44').send({ token: 'good' });
    expect(res.status).toBe(200);
    expect(typeof res.body.jwt).toBe('string');
    expect(res.body.user).toMatchObject({ base44_id: 'b44-ok', is_banned: false });
  });

  it('gesperrter (blocked) Account → 403', async () => {
    await getStrapi().db.query(USER_UID).create({
      data: { username: 'blk', email: 'blk@x.de', password: 'Test1234!', confirmed: true, blocked: true, base44_id: 'b44-blk', role: await roleId('authenticated') },
    });
    process.env.BASE44_ME_URL = 'http://base44.local/me';
    mockFetchUser({ id: 'b44-blk', email: 'blk@x.de' });
    const res = await http().post('/api/auth/base44').send({ token: 'good' });
    expect(res.status).toBe(403);
  });
});
