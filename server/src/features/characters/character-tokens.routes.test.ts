import { CHARACTER_EVENTS, PLAY_AREA_EVENTS } from '@vtt/shared';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { getIo } from '../../shared/socket/io-instance.js';
import { loginAs } from '../../shared/test-utils/login.js';
import { hashPassword } from '../../shared/utils/password.js';

// Helpers

async function createUser(overrides: { username: string; email: string }): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const password = 'password123';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: overrides.username,
      email: overrides.email,
      passwordHash,
    },
  });
  return { id: user.id, email: user.email, password };
}

const ABILITY_SCORES = {
  strength: 16,
  dexterity: 14,
  constitution: 12,
  intelligence: 10,
  wisdom: 13,
  charisma: 8,
};

describe('Character-Token Link Routes', () => {
  const TEST_USERNAMES = ['CharTok_DM', 'CharTok_Player', 'CharTok_Other', 'CharTok_Observer'];

  beforeAll(async () => {
    const leftover = await prisma.user.findMany({ where: { username: { in: TEST_USERNAMES } } });
    const leftoverIds = leftover.map((u) => u.id);
    if (leftoverIds.length > 0) {
      await prisma.campaign.deleteMany({
        where: { members: { some: { userId: { in: leftoverIds } } } },
      });
      await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
    }
  });

  let dmCookies: string[];
  let playerId: string;
  let playerCookies: string[];
  let otherId: string;
  let otherCookies: string[];
  let observerId: string;
  let observerCookies: string[];
  let campaignId: string;
  let sceneId: string;
  let playerTokenId: string;
  let otherTokenId: string;
  let playerCharId: string;
  let otherCharId: string;

  const emitSpy = vi.fn();
  let toSpy: MockInstance;

  beforeEach(async () => {
    const dm = await createUser({ username: 'CharTok_DM', email: 'dm@chartok-test.com' });
    dmCookies = await loginAs(dm.email, dm.password);

    const player = await createUser({ username: 'CharTok_Player', email: 'player@chartok-test.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    const other = await createUser({ username: 'CharTok_Other', email: 'other@chartok-test.com' });
    otherId = other.id;
    otherCookies = await loginAs(other.email, other.password);

    const observer = await createUser({
      username: 'CharTok_Observer',
      email: 'observer@chartok-test.com',
    });
    observerId = observer.id;
    observerCookies = await loginAs(observer.email, observer.password);

    const campRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'CharTok Test Campaign' })
      .expect(201);
    campaignId = campRes.body.data.id;

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: player.email, role: 'player' })
      .expect(201);
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: other.email, role: 'player' })
      .expect(201);
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: observer.email, role: 'observer' })
      .expect(201);

    // The invite flow auto-creates an active default scene — deactivate it so the
    // test scene can be the single active scene per campaign (5H partial unique index)
    await prisma.scene.updateMany({ where: { campaignId }, data: { isActive: false } });
    const scene = await prisma.scene.create({
      data: { campaignId, name: 'CharTok Scene', isActive: true },
    });
    sceneId = scene.id;

    const playerToken = await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        ownerId: playerId,
        name: 'Player Token',
        type: 'player',
        hp: 10,
        maxHp: 10,
      },
    });
    playerTokenId = playerToken.id;

    const otherToken = await prisma.token.create({
      data: {
        sceneId,
        campaignId,
        ownerId: otherId,
        name: 'Other Token',
        type: 'player',
        hp: 10,
        maxHp: 10,
      },
    });
    otherTokenId = otherToken.id;

    const playerChar = await prisma.character.create({
      data: {
        campaignId,
        userId: playerId,
        name: 'Thorin Linkforge',
        race: 'Dwarf',
        class: 'Fighter',
        level: 5,
        abilityScores: ABILITY_SCORES,
        hp: 44,
        maxHp: 44,
        ac: 18,
        portraitUrl: 'https://example.com/thorin.png',
      },
    });
    playerCharId = playerChar.id;

    const otherChar = await prisma.character.create({
      data: {
        campaignId,
        userId: otherId,
        name: 'Elara Linkwhisper',
        race: 'Elf',
        class: 'Wizard',
        level: 5,
        abilityScores: ABILITY_SCORES,
        hp: 32,
        maxHp: 32,
        ac: 12,
      },
    });
    otherCharId = otherChar.id;

    emitSpy.mockClear();
    toSpy = vi.spyOn(getIo()!, 'to').mockReturnValue({ emit: emitSpy } as never);
  });

  afterEach(async () => {
    toSpy.mockRestore();
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { username: { in: TEST_USERNAMES } } });
  });

  function linkUrl(): string {
    return `/api/campaigns/${campaignId}/character-tokens`;
  }

  // -------------------------------------------------------------------------
  // POST /api/campaigns/:id/character-tokens
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/character-tokens', () => {
    it('links any character to any token as DM', async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: otherTokenId })
        .expect(201);

      expect(res.body.data.characterId).toBe(playerCharId);
      expect(res.body.data.tokenId).toBe(otherTokenId);
    });

    it('copies character display fields onto the token and transfers ownership', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);

      const token = await prisma.token.findUnique({ where: { id: playerTokenId } });
      expect(token?.name).toBe('Thorin Linkforge');
      expect(token?.hp).toBe(44);
      expect(token?.maxHp).toBe(44);
      expect(token?.ac).toBe(18);
      expect(token?.iconUrl).toBe('https://example.com/thorin.png');
      expect(token?.ownerId).toBe(playerId);
    });

    it('broadcasts link and token updates to the campaign room', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);

      expect(toSpy).toHaveBeenCalledWith(`campaign:${campaignId}`);
      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).toContain(CHARACTER_EVENTS.LINK_UPDATED);
      expect(events).toContain(PLAY_AREA_EVENTS.TOKEN_UPDATED);
    });

    it('lets a player link their own character to their own token', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', playerCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);
    });

    it("rejects a player linking another user's character", async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', playerCookies)
        .send({ characterId: otherCharId, tokenId: playerTokenId })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it("rejects a player linking to another user's token", async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', playerCookies)
        .send({ characterId: playerCharId, tokenId: otherTokenId })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for an unknown character or token', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: 'nope', tokenId: playerTokenId })
        .expect(404);

      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: 'nope' })
        .expect(404);
    });

    it('rejects an invalid payload', async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects observers', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', observerCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(403);
    });

    it('replaces an existing link when a token is linked to a new character', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);

      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: otherCharId, tokenId: playerTokenId })
        .expect(201);

      const links = await prisma.characterToken.findMany({ where: { campaignId } });
      expect(links).toHaveLength(1);
      expect(links[0]!.characterId).toBe(otherCharId);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/campaigns/:id/character-tokens
  // -------------------------------------------------------------------------

  describe('GET /api/campaigns/:id/character-tokens', () => {
    it('lists links for campaign members', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);

      const res = await request(app).get(linkUrl()).set('Cookie', playerCookies).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].characterId).toBe(playerCharId);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/campaigns/:id/character-tokens/:linkId
  // -------------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id/character-tokens/:linkId', () => {
    async function createLink(): Promise<string> {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);
      return res.body.data.id;
    }

    it('unlinks as DM', async () => {
      const linkId = await createLink();
      await request(app).delete(`${linkUrl()}/${linkId}`).set('Cookie', dmCookies).expect(204);

      const remaining = await prisma.characterToken.findMany({ where: { campaignId } });
      expect(remaining).toHaveLength(0);
    });

    it('unlinks as the character owner', async () => {
      const linkId = await createLink();
      await request(app).delete(`${linkUrl()}/${linkId}`).set('Cookie', playerCookies).expect(204);
    });

    it("rejects unlinking another user's character", async () => {
      const linkId = await createLink();
      const res = await request(app)
        .delete(`${linkUrl()}/${linkId}`)
        .set('Cookie', otherCookies)
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for an unknown link', async () => {
      await request(app).delete(`${linkUrl()}/nope`).set('Cookie', dmCookies).expect(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/campaigns/:id/characters/:charId/assign
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/characters/:charId/assign', () => {
    function assignUrl(charId: string): string {
      return `/api/campaigns/${campaignId}/characters/${charId}/assign`;
    }

    it('assigns a character to another player as DM and auto-links their token', async () => {
      const res = await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', dmCookies)
        .send({ userId: otherId })
        .expect(200);

      expect(res.body.data.userId).toBe(otherId);
      expect(res.body.data.previousUserId).toBe(playerId);

      const character = await prisma.character.findUnique({ where: { id: playerCharId } });
      expect(character?.userId).toBe(otherId);

      // Auto-linked to a token owned by the assignee — no separate link step
      const link = await prisma.characterToken.findFirst({
        where: { characterId: playerCharId },
      });
      expect(link).not.toBeNull();

      const token = await prisma.token.findUnique({ where: { id: link!.tokenId } });
      expect(token?.ownerId).toBe(otherId);
      expect(token?.name).toBe('Thorin Linkforge');
    });

    it('relinks to the new owner\'s token when a linked character is reassigned', async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);

      await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', dmCookies)
        .send({ userId: otherId })
        .expect(200);

      const links = await prisma.characterToken.findMany({
        where: { characterId: playerCharId },
      });
      expect(links).toHaveLength(1);

      const token = await prisma.token.findUnique({ where: { id: links[0]!.tokenId } });
      expect(token?.ownerId).toBe(otherId);
    });

    it('lets a player assign a character to themselves', async () => {
      await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', playerCookies)
        .send({ userId: playerId })
        .expect(200);

      const link = await prisma.characterToken.findFirst({
        where: { characterId: playerCharId },
      });
      expect(link).not.toBeNull();

      const token = await prisma.token.findUnique({ where: { id: link!.tokenId } });
      expect(token?.ownerId).toBe(playerId);
    });

    it('broadcasts the assignment change', async () => {
      await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', dmCookies)
        .send({ userId: otherId })
        .expect(200);

      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).toContain(CHARACTER_EVENTS.ASSIGNMENT_CHANGED);
      expect(events).toContain(CHARACTER_EVENTS.LINK_UPDATED);
      expect(events).toContain(PLAY_AREA_EVENTS.TOKEN_UPDATED);
    });

    it('rejects a player assigning a character to someone else', async () => {
      const res = await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', playerCookies)
        .send({ userId: otherId })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it("rejects a player claiming another player's character for themselves", async () => {
      const res = await request(app)
        .post(assignUrl(otherCharId))
        .set('Cookie', playerCookies)
        .send({ userId: playerId })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');

      const character = await prisma.character.findUnique({ where: { id: otherCharId } });
      expect(character?.userId).toBe(otherId);
    });

    it('rejects assigning to an observer', async () => {
      const res = await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', dmCookies)
        .send({ userId: observerId })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });

    it('rejects assigning to a non-member', async () => {
      const res = await request(app)
        .post(assignUrl(playerCharId))
        .set('Cookie', dmCookies)
        .send({ userId: 'not-a-member' })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_ASSIGNEE');
    });
  });

  // -------------------------------------------------------------------------
  // Global template characters (campaignId null)
  // -------------------------------------------------------------------------

  describe('global template characters', () => {
    let templateId: string;

    beforeEach(async () => {
      // Owned by the DM test user, so it cascades away with user cleanup
      const dmUser = await prisma.user.findFirst({ where: { username: 'CharTok_DM' } });
      const template = await prisma.character.create({
        data: {
          campaignId: null,
          userId: dmUser!.id,
          name: 'Template Hero',
          race: 'Human',
          class: 'Paladin',
          level: 3,
          abilityScores: ABILITY_SCORES,
          hp: 28,
          maxHp: 28,
          ac: 16,
          portraitUrl: '/tokens/token1.png',
        },
      });
      templateId = template.id;
    });

    it('clones the template into the campaign when the DM links it', async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: templateId, tokenId: playerTokenId })
        .expect(201);

      // The link points at a campaign-local clone, not the template
      expect(res.body.data.characterId).not.toBe(templateId);

      const clone = await prisma.character.findUnique({
        where: { id: res.body.data.characterId },
      });
      expect(clone?.campaignId).toBe(campaignId);
      expect(clone?.userId).toBe(playerId); // follows the token owner
      expect(clone?.name).toBe('Template Hero');

      const template = await prisma.character.findUnique({ where: { id: templateId } });
      expect(template?.campaignId).toBeNull();

      const token = await prisma.token.findUnique({ where: { id: playerTokenId } });
      expect(token?.name).toBe('Template Hero');
      expect(token?.iconUrl).toBe('/tokens/token1.png');
    });

    it('lets a player claim a template by linking it to their own token', async () => {
      const res = await request(app)
        .post(linkUrl())
        .set('Cookie', playerCookies)
        .send({ characterId: templateId, tokenId: playerTokenId })
        .expect(201);

      const clone = await prisma.character.findUnique({
        where: { id: res.body.data.characterId },
      });
      expect(clone?.userId).toBe(playerId);
      expect(clone?.campaignId).toBe(campaignId);
    });

    it('clones the template on DM assignment and auto-links the assignee\'s token', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters/${templateId}/assign`)
        .set('Cookie', dmCookies)
        .send({ userId: otherId })
        .expect(200);

      expect(res.body.data.characterId).not.toBe(templateId);

      const clone = await prisma.character.findUnique({
        where: { id: res.body.data.characterId },
      });
      expect(clone?.userId).toBe(otherId);
      expect(clone?.campaignId).toBe(campaignId);

      const link = await prisma.characterToken.findFirst({
        where: { characterId: res.body.data.characterId },
      });
      expect(link).not.toBeNull();

      const linkedToken = await prisma.token.findUnique({ where: { id: link!.tokenId } });
      expect(linkedToken?.ownerId).toBe(otherId);
    });

    it('rejects edits to templates', async () => {
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${templateId}`)
        .set('Cookie', dmCookies)
        .send({ hp: 10 })
        .expect(403);

      expect(res.body.error.code).toBe('TEMPLATE_READONLY');
    });
  });

  // -------------------------------------------------------------------------
  // HP sync (sheet ↔ token)
  // -------------------------------------------------------------------------

  describe('HP sync', () => {
    beforeEach(async () => {
      await request(app)
        .post(linkUrl())
        .set('Cookie', dmCookies)
        .send({ characterId: playerCharId, tokenId: playerTokenId })
        .expect(201);
      emitSpy.mockClear();
    });

    it('updates the linked token when character HP changes', async () => {
      await request(app)
        .patch(`/api/campaigns/${campaignId}/characters/${playerCharId}/hp`)
        .set('Cookie', playerCookies)
        .send({ hp: 20 })
        .expect(200);

      const token = await prisma.token.findUnique({ where: { id: playerTokenId } });
      expect(token?.hp).toBe(20);

      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).toContain(CHARACTER_EVENTS.HP_UPDATED);
      expect(events).toContain(PLAY_AREA_EVENTS.TOKEN_UPDATED);
    });

    it('updates the linked character when token HP changes', async () => {
      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${playerTokenId}`)
        .set('Cookie', dmCookies)
        .send({ hp: 15 })
        .expect(200);

      const character = await prisma.character.findUnique({ where: { id: playerCharId } });
      expect(character?.hp).toBe(15);

      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).toContain(CHARACTER_EVENTS.HP_UPDATED);
    });

    it("clamps token HP to the character's max HP when syncing", async () => {
      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${playerTokenId}`)
        .set('Cookie', dmCookies)
        .send({ hp: 500 })
        .expect(200);

      const character = await prisma.character.findUnique({ where: { id: playerCharId } });
      expect(character?.hp).toBe(44);

      // The token is corrected to the clamped value so the two never diverge
      const token = await prisma.token.findUnique({ where: { id: playerTokenId } });
      expect(token?.hp).toBe(44);
    });

    it('does not touch unlinked characters on token HP change', async () => {
      await request(app)
        .put(`/api/campaigns/${campaignId}/scenes/${sceneId}/tokens/${otherTokenId}`)
        .set('Cookie', dmCookies)
        .send({ hp: 3 })
        .expect(200);

      const character = await prisma.character.findUnique({ where: { id: otherCharId } });
      expect(character?.hp).toBe(32);
    });
  });
});
