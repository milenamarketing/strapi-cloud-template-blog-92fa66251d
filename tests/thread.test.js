'use strict';

const { setupStrapi, teardownStrapi, http } = require('./helpers/strapi');
const { makeUser, jwtFor, makeThread, clear } = require('./helpers/factories');

const THREAD_UID = 'api::thread.thread';
const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(THREAD_UID, USER_UID);
});

const auth = (jwt) => `Bearer ${jwt}`;

describe('POST /api/threads (create)', () => {
  it('lehnt ohne JWT ab (kein öffentliches Erstellen)', async () => {
    const res = await http().post('/api/threads').send({ data: { title: 'X', content: 'Y' } });
    expect([401, 403]).toContain(res.status);
  });

  it('setzt Autor serverseitig und ignoriert Client-injizierte Felder (Whitelist)', async () => {
    const user = await makeUser({ display_name: 'Mara', base44_id: 'b44-mara' });
    const res = await http()
      .post('/api/threads')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { title: 'Hallo', content: 'Welt', category: 'Allgemein', likes_count: 999, author_name: 'FAKE' } });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.title).toBe('Hallo');
    expect(data.author_name).toBe('Mara');
    expect(data.author_base44_id).toBe('b44-mara');
    expect(data.likes_count).toBe(0); // Client-Wert 999 ignoriert
  });

  it('Sperre full_ban → 403 mit banned-Payload', async () => {
    const user = await makeUser({ is_banned: true, ban_type: 'full_ban', ban_reason: 'Spam' });
    const res = await http()
      .post('/api/threads')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { title: 'T', content: 'C' } });

    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({ banned: true, ban_type: 'full_ban', ban_reason: 'Spam' });
  });

  it('Sperre comments_only erlaubt das Erstellen von Beiträgen', async () => {
    const user = await makeUser({ is_banned: true, ban_type: 'comments_only' });
    const res = await http()
      .post('/api/threads')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { title: 'T', content: 'C' } });
    expect(res.status).toBe(200);
  });
});

describe('PUT/DELETE /api/threads/:id (Berechtigung)', () => {
  it('Fremde dürfen fremden Beitrag nicht ändern/löschen', async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const thread = await makeThread({ author });

    const upd = await http()
      .put(`/api/threads/${thread.documentId}`)
      .set('Authorization', auth(jwtFor(stranger)))
      .send({ data: { title: 'Hack' } });
    expect(upd.status).toBe(403);

    const del = await http()
      .delete(`/api/threads/${thread.documentId}`)
      .set('Authorization', auth(jwtFor(stranger)));
    expect(del.status).toBe(403);
  });

  it('Autorin darf bearbeiten, aber pinned bleibt für Nicht-Moderatorin unverändert', async () => {
    const author = await makeUser();
    const thread = await makeThread({ author, pinned: false });

    const res = await http()
      .put(`/api/threads/${thread.documentId}`)
      .set('Authorization', auth(jwtFor(author)))
      .send({ data: { title: 'Neuer Titel', pinned: true } });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Neuer Titel');
    expect(res.body.data.pinned).toBe(false); // pinned nur für Moderatorin
  });

  it('Moderatorin darf fremden Beitrag anpinnen', async () => {
    const author = await makeUser();
    const moderator = await makeUser({ role: 'moderator' });
    const thread = await makeThread({ author, pinned: false });

    const res = await http()
      .put(`/api/threads/${thread.documentId}`)
      .set('Authorization', auth(jwtFor(moderator)))
      .send({ data: { pinned: true } });

    expect(res.status).toBe(200);
    expect(res.body.data.pinned).toBe(true);
  });
});
