'use strict';

const { setupStrapi, teardownStrapi, getStrapi } = require('./helpers/strapi');
const { makeUser, makeThread, makeReport, clear } = require('./helpers/factories');
const mod = require('../src/community-moderation');

const REPORT_UID = 'api::report.report';
const THREAD_UID = 'api::thread.thread';
const USER_UID = 'plugin::users-permissions.user';

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear(REPORT_UID, THREAD_UID, USER_UID);
});

const reload = (uid, id) => getStrapi().db.query(uid).findOne({ where: { id } });

describe('Verdict-Workflow (afterUpdate)', () => {
  it('justified → Zähler +1 & counted=true; Rücknahme → −1 & counted=false', async () => {
    const author = await makeUser({ base44_id: 'b44-x' });
    const report = await makeReport({
      target_type: 'thread',
      reported_user_base44_id: 'b44-x',
      reported_user_name: author.display_name,
    });
    const docs = getStrapi().documents(REPORT_UID);

    await docs.update({ documentId: report.documentId, data: { verdict: 'justified' } });
    let r = await reload(REPORT_UID, report.id);
    let a = await reload(USER_UID, author.id);
    expect(r.counted).toBe(true);
    expect(a.reporting_count_posts).toBe(1);

    await docs.update({ documentId: report.documentId, data: { verdict: 'rejected' } });
    r = await reload(REPORT_UID, report.id);
    a = await reload(USER_UID, author.id);
    expect(r.counted).toBe(false);
    expect(a.reporting_count_posts).toBe(0);
  });

  it('Kommentar-Meldung erhöht reporting_count_comments', async () => {
    const author = await makeUser({ base44_id: 'b44-c' });
    const report = await makeReport({ target_type: 'comment', reported_user_base44_id: 'b44-c' });
    await getStrapi().documents(REPORT_UID).update({ documentId: report.documentId, data: { verdict: 'justified' } });
    const a = await reload(USER_UID, author.id);
    expect(a.reporting_count_comments).toBe(1);
  });
});

describe('Moderations-Aktion delete_content', () => {
  it('löscht den verknüpften Thread und merkt sich content_deleted', async () => {
    const author = await makeUser();
    const thread = await makeThread({ author });
    const report = await makeReport({ target_type: 'thread', threadId: thread.documentId, reported_user_base44_id: author.base44_id });

    await getStrapi().documents(REPORT_UID).update({
      documentId: report.documentId,
      data: { moderation_action: 'delete_content' },
    });

    const gone = await getStrapi().db.query(THREAD_UID).findOne({ where: { id: thread.id } });
    const r = await reload(REPORT_UID, report.id);
    expect(gone).toBeNull();
    expect(r.content_deleted).toBe(true);
    expect(r.status).toBe('resolved');
  });
});

describe('recomputeReportAlert (7-Tage-Schwelle)', () => {
  it('> 10 justified → ⚠️, genau 10 → leer', async () => {
    const user = await makeUser({ base44_id: 'b44-alert' });

    const mkJustified = () => makeReport({ verdict: 'justified', reported_user_base44_id: 'b44-alert' });

    for (let i = 0; i < 10; i++) await mkJustified();
    await mod.recomputeReportAlert('b44-alert');
    let u = await reload(USER_UID, user.id);
    expect(u.report_alert || '').toBe(''); // 10 ist NICHT > 10

    await mkJustified(); // jetzt 11
    await mod.recomputeReportAlert('b44-alert');
    u = await reload(USER_UID, user.id);
    expect(u.report_alert).toBe('⚠️');
  });
});
