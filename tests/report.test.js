'use strict';

const { setupStrapi, teardownStrapi, http } = require('./helpers/strapi');
const { makeUser, jwtFor, makeThread, makeComment, clear } = require('./helpers/factories');
const { getStrapi } = require('./helpers/strapi');

const UIDS = ['api::report.report', 'api::comment.comment', 'api::thread.thread', 'plugin::users-permissions.user'];

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(...UIDS);
});

const auth = (jwt) => `Bearer ${jwt}`;

describe('POST /api/reports (create)', () => {
  it('lehnt ohne JWT ab', async () => {
    const res = await http().post('/api/reports').send({ data: { reason: 'spam' } });
    expect([401, 403]).toContain(res.status);
  });

  it('Meldung zählt NICHT automatisch (pending, counted=false, kein Zähler, denormalisiert)', async () => {
    const author = await makeUser({ display_name: 'Autorin', base44_id: 'b44-autorin' });
    const reporter = await makeUser();
    const thread = await makeThread({ author, title: 'Strittig', content: 'Inhalt' });

    const res = await http()
      .post('/api/reports')
      .set('Authorization', auth(jwtFor(reporter)))
      .send({ data: { reason: 'harassment', details: 'unfreundlich', thread: thread.documentId } });

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.verdict).toBe('pending');
    expect(d.target_type).toBe('thread');
    expect(d.reported_user_name).toBe('Autorin');
    expect(d.reported_user_base44_id).toBe('b44-autorin');
    expect(d.context_text).toContain('Strittig');

    // `counted` ist privat (nicht im API-Output) → über die DB prüfen.
    const stored = await getStrapi().db
      .query('api::report.report')
      .findOne({ where: { documentId: d.documentId } });
    expect(stored.counted).toBe(false);

    // Zähler der gemeldeten Autorin bleibt unverändert (Kernregel).
    const reloaded = await getStrapi().db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: author.id } });
    expect(reloaded.reporting_count_posts).toBe(0);
  });

  it('Kommentar-Meldung setzt target_type=comment', async () => {
    const author = await makeUser();
    const reporter = await makeUser();
    const thread = await makeThread({ author });
    const comment = await makeComment({ author, threadId: thread.documentId, content: 'frech' });

    const res = await http()
      .post('/api/reports')
      .set('Authorization', auth(jwtFor(reporter)))
      .send({ data: { reason: 'spam', comment: comment.documentId } });

    expect(res.status).toBe(200);
    expect(res.body.data.target_type).toBe('comment');
  });
});

describe('GET /api/reports (nur SuperAdmin)', () => {
  it('authenticated → 403, superadmin → 200', async () => {
    const normal = await makeUser();
    const superadmin = await makeUser({ role: 'superadmin' });

    const forbidden = await http().get('/api/reports').set('Authorization', auth(jwtFor(normal)));
    expect(forbidden.status).toBe(403);

    const ok = await http().get('/api/reports').set('Authorization', auth(jwtFor(superadmin)));
    expect(ok.status).toBe(200);
  });
});
