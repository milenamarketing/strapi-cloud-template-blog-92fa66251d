'use strict';

const { setupStrapi, teardownStrapi } = require('./helpers/strapi');
const { makeUser, clear } = require('./helpers/factories');
const mod = require('../src/community-moderation');

beforeAll(async () => {
  await setupStrapi();
}, 120000);

afterAll(async () => {
  await teardownStrapi();
});

afterEach(async () => {
  await clear('plugin::users-permissions.user');
});

describe('banBlocks (rein, ohne DB)', () => {
  const cases = [
    ['nicht gesperrt', { is_banned: false }, 'post', false],
    ['nicht gesperrt', { is_banned: false }, 'comment', false],
    ['full_ban blockt Beitrag', { is_banned: true, ban_type: 'full_ban' }, 'post', true],
    ['full_ban blockt Kommentar', { is_banned: true, ban_type: 'full_ban' }, 'comment', true],
    ['comments_only blockt nur Kommentar', { is_banned: true, ban_type: 'comments_only' }, 'comment', true],
    ['comments_only erlaubt Beitrag', { is_banned: true, ban_type: 'comments_only' }, 'post', false],
    ['posts_only blockt nur Beitrag', { is_banned: true, ban_type: 'posts_only' }, 'post', true],
    ['posts_only erlaubt Kommentar', { is_banned: true, ban_type: 'posts_only' }, 'comment', false],
    ['unbekannter ban_type blockt nicht', { is_banned: true, ban_type: 'whatever' }, 'post', false],
    ['null-User', null, 'post', false],
  ];
  it.each(cases)('%s (%j → %s)', (_label, user, action, expected) => {
    expect(mod.banBlocks(user, action)).toBe(expected);
  });
});

describe('Rollen-Helfer (gegen echte Rollen)', () => {
  it('roleTypeOf lädt den Rollentyp nach', async () => {
    const u = await makeUser({ role: 'moderator' });
    expect(await mod.roleTypeOf(u)).toBe('moderator');
  });

  it('isModerator: moderator/superadmin true, authenticated false', async () => {
    expect(await mod.isModerator(await makeUser({ role: 'moderator' }))).toBe(true);
    expect(await mod.isModerator(await makeUser({ role: 'superadmin' }))).toBe(true);
    expect(await mod.isModerator(await makeUser({ role: 'authenticated' }))).toBe(false);
    expect(await mod.isModerator(null)).toBe(false);
  });

  it('isSuperAdmin: nur superadmin (admin zählt mit), moderator nicht', async () => {
    expect(await mod.isSuperAdmin(await makeUser({ role: 'superadmin' }))).toBe(true);
    expect(await mod.isSuperAdmin(await makeUser({ role: 'moderator' }))).toBe(false);
  });
});

describe('canModify', () => {
  it('Autorin darf, Fremde nicht, Moderatorin darf', async () => {
    const author = await makeUser();
    const stranger = await makeUser();
    const moderator = await makeUser({ role: 'moderator' });
    const entity = { author: { id: author.id } };

    expect(await mod.canModify(author, entity)).toBe(true);
    expect(await mod.canModify(stranger, entity)).toBe(false);
    expect(await mod.canModify(moderator, entity)).toBe(true);
    expect(await mod.canModify(null, entity)).toBe(false);
  });
});
