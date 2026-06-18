'use strict';

const { setupStrapi, teardownStrapi, http } = require('./helpers/strapi');
const { makeUser, jwtFor, clear } = require('./helpers/factories');

const APPEAL_UID = 'api::ban-appeal.ban-appeal';
const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(APPEAL_UID, USER_UID);
});

const auth = (jwt) => `Bearer ${jwt}`;

describe('POST /api/ban-appeals (create)', () => {
  it('lehnt ohne JWT ab', async () => {
    const res = await http().post('/api/ban-appeals').send({ data: { message: 'Bitte' } });
    expect([401, 403]).toContain(res.status);
  });

  it('auch ein gesperrter Nutzer darf Einspruch einlegen (denormalisiert + gekürzt)', async () => {
    const banned = await makeUser({
      is_banned: true,
      ban_type: 'full_ban',
      display_name: 'Gesperrt',
      base44_id: 'b44-gesperrt',
    });
    const long = 'x'.repeat(2500);

    const res = await http()
      .post('/api/ban-appeals')
      .set('Authorization', auth(jwtFor(banned)))
      .send({ data: { message: long } });

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.user_name).toBe('Gesperrt');
    expect(d.user_base44_id).toBe('b44-gesperrt');
    expect(d.ban_type_at_time).toBe('full_ban');
    expect(d.message.length).toBe(2000); // auf 2000 gekürzt
  });
});

describe('GET /api/ban-appeals (nur SuperAdmin)', () => {
  it('authenticated → 403, superadmin → 200', async () => {
    const normal = await makeUser();
    const superadmin = await makeUser({ role: 'superadmin' });
    expect((await http().get('/api/ban-appeals').set('Authorization', auth(jwtFor(normal)))).status).toBe(403);
    expect((await http().get('/api/ban-appeals').set('Authorization', auth(jwtFor(superadmin)))).status).toBe(200);
  });
});
