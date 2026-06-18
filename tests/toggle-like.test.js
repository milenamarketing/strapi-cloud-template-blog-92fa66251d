'use strict';

const { setupStrapi, teardownStrapi, http } = require('./helpers/strapi');
const { makeUser, jwtFor, makeThread, clear } = require('./helpers/factories');

const LIKE_UID = 'api::like.like';
const THREAD_UID = 'api::thread.thread';
const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(LIKE_UID, THREAD_UID, USER_UID);
});

const auth = (jwt) => `Bearer ${jwt}`;

describe('POST /api/threads/:id/toggle-like', () => {
  it('lehnt ohne JWT ab', async () => {
    const thread = await makeThread({});
    const res = await http().post(`/api/threads/${thread.documentId}/toggle-like`);
    expect([401, 403]).toContain(res.status);
  });

  it('liket beim ersten Aufruf, entliket idempotent beim zweiten (Zähler nie negativ)', async () => {
    const user = await makeUser();
    const thread = await makeThread({ likes_count: 0 });
    const url = `/api/threads/${thread.documentId}/toggle-like`;

    const first = await http().post(url).set('Authorization', auth(jwtFor(user)));
    expect(first.status).toBe(200);
    expect(first.body.data.liked).toBe(true);
    expect(first.body.data.likes_count).toBe(1);

    const second = await http().post(url).set('Authorization', auth(jwtFor(user)));
    expect(second.status).toBe(200);
    expect(second.body.data.liked).toBe(false);
    expect(second.body.data.likes_count).toBe(0);
  });
});
