'use strict';

const { setupStrapi, teardownStrapi, http } = require('./helpers/strapi');
const { makeUser, jwtFor, makeThread, makeComment, clear } = require('./helpers/factories');

const COMMENT_UID = 'api::comment.comment';
const THREAD_UID = 'api::thread.thread';
const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(COMMENT_UID, THREAD_UID, USER_UID);
});

const auth = (jwt) => `Bearer ${jwt}`;

describe('POST /api/comments (create)', () => {
  it('lehnt ohne JWT ab', async () => {
    const res = await http().post('/api/comments').send({ data: { content: 'Hi' } });
    expect([401, 403]).toContain(res.status);
  });

  it('setzt Autor serverseitig', async () => {
    const user = await makeUser({ display_name: 'Lea', base44_id: 'b44-lea' });
    const thread = await makeThread({ author: user });
    const res = await http()
      .post('/api/comments')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { content: 'Mein Kommentar', thread: thread.documentId } });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Mein Kommentar');
    expect(res.body.data.author_name).toBe('Lea');
    expect(res.body.data.author_base44_id).toBe('b44-lea');
  });

  it('Sperre comments_only/full_ban → 403, posts_only erlaubt', async () => {
    const thread = await makeThread({});
    const banned = await makeUser({ is_banned: true, ban_type: 'comments_only' });
    const r1 = await http()
      .post('/api/comments')
      .set('Authorization', auth(jwtFor(banned)))
      .send({ data: { content: 'X', thread: thread.documentId } });
    expect(r1.status).toBe(403);
    expect(r1.body.error.details.banned).toBe(true);

    const postsOnly = await makeUser({ is_banned: true, ban_type: 'posts_only' });
    const r2 = await http()
      .post('/api/comments')
      .set('Authorization', auth(jwtFor(postsOnly)))
      .send({ data: { content: 'Y', thread: thread.documentId } });
    expect(r2.status).toBe(200);
  });

  it('Thread mit comments_enabled=false → 403', async () => {
    const user = await makeUser();
    const thread = await makeThread({ comments_enabled: false });
    const res = await http()
      .post('/api/comments')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { content: 'Z', thread: thread.documentId } });
    expect(res.status).toBe(403);
  });

  it('verschachtelte Antwort (parent) wird verknüpft', async () => {
    const user = await makeUser();
    const thread = await makeThread({ author: user });
    const parent = await makeComment({ author: user, threadId: thread.documentId });
    const res = await http()
      .post('/api/comments')
      .set('Authorization', auth(jwtFor(user)))
      .send({ data: { content: 'Antwort', thread: thread.documentId, parent: parent.documentId } });
    expect(res.status).toBe(200);
  });
});

describe('PUT/DELETE /api/comments/:id (Berechtigung)', () => {
  it('Fremde dürfen nicht, Autorin/Moderatorin schon', async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const moderator = await makeUser({ role: 'moderator' });
    const thread = await makeThread({ author });
    const comment = await makeComment({ author, threadId: thread.documentId });

    const bad = await http()
      .delete(`/api/comments/${comment.documentId}`)
      .set('Authorization', auth(jwtFor(stranger)));
    expect(bad.status).toBe(403);

    const ok = await http()
      .delete(`/api/comments/${comment.documentId}`)
      .set('Authorization', auth(jwtFor(moderator)));
    expect([200, 204]).toContain(ok.status);
  });
});
