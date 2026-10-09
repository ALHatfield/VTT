import { randomUUID } from 'node:crypto';

import { CHARACTER_EVENTS } from '@vtt/shared';
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

const VALID_ABILITY_SCORES = {
  strength: 16,
  dexterity: 14,
  constitution: 12,
  intelligence: 10,
  wisdom: 13,
  charisma: 8,
};

const VALID_CHARACTER_PAYLOAD = {
  name: 'Thorin',
  race: 'Dwarf',
  class: 'Fighter',
  level: 5,
  abilityScores: VALID_ABILITY_SCORES,
  hp: 44,
  maxHp: 44,
  ac: 18,
  speed: 25,
};

const VALID_ATTACK = {
  id: randomUUID(),
  name: 'Longsword',
  ability: 'strength',
  proficient: true,
  damageDice: '1d8',
};

describe('Character Routes', () => {
  const TEST_USERNAMES = ['Char_DM', 'Char_Player', 'Char_Observer', 'Char_Other'];

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

  let dmId: string;
  let dmCookies: string[];
  let playerId: string;
  let playerCookies: string[];
  let observerCookies: string[];
  let campaignId: string;

  beforeEach(async () => {
    const dm = await createUser({ username: 'Char_DM', email: 'dm@char-test.com' });
    dmId = dm.id;
    dmCookies = await loginAs(dm.email, dm.password);

    const player = await createUser({ username: 'Char_Player', email: 'player@char-test.com' });
    playerId = player.id;
    playerCookies = await loginAs(player.email, player.password);

    const observer = await createUser({ username: 'Char_Observer', email: 'observer@char-test.com' });
    observerCookies = await loginAs(observer.email, observer.password);

    // Create campaign as DM
    const campRes = await request(app)
      .post('/api/campaigns')
      .set('Cookie', dmCookies)
      .send({ name: 'Character Test Campaign' })
      .expect(201);
    campaignId = campRes.body.data.id;

    // Invite player and observer
    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: player.email, role: 'player' })
      .expect(201);

    await request(app)
      .post(`/api/campaigns/${campaignId}/invite`)
      .set('Cookie', dmCookies)
      .send({ email: observer.email, role: 'observer' })
      .expect(201);
  });

  afterEach(async () => {
    await prisma.character.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.user.deleteMany({ where: { username: { in: TEST_USERNAMES } } });
  });

  // -------------------------------------------------------------------------
  // POST /api/campaigns/:id/characters
  // -------------------------------------------------------------------------

  describe('POST /api/campaigns/:id/characters', () => {
    it('creates a character as DM', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      expect(res.body.data).toMatchObject({
        name: 'Thorin',
        race: 'Dwarf',
        class: 'Fighter',
        level: 5,
        hp: 44,
        maxHp: 44,
        ac: 18,
      });
      expect(res.body.data.id).toBeTruthy();
      expect(res.body.data.userId).toBe(dmId);
    });

    it('defaults skill proficiencies and attacks to empty arrays', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      expect(res.body.data.skillProficiencies).toEqual([]);
      expect(res.body.data.attacks).toEqual([]);
    });

    it('creates a character with skill proficiencies and attacks (Phase 6C)', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send({
          ...VALID_CHARACTER_PAYLOAD,
          skillProficiencies: ['athletics', 'intimidation'],
          attacks: [VALID_ATTACK],
        })
        .expect(201);

      expect(res.body.data.skillProficiencies).toEqual(['athletics', 'intimidation']);
      expect(res.body.data.attacks).toEqual([VALID_ATTACK]);
    });

    it('returns 400 for an unknown skill name', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send({ ...VALID_CHARACTER_PAYLOAD, skillProficiencies: ['basketweaving'] })
        .expect(400);
    });

    it('returns 400 for invalid attack damage dice', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send({
          ...VALID_CHARACTER_PAYLOAD,
          attacks: [{ ...VALID_ATTACK, damageDice: 'banana' }],
        })
        .expect(400);
    });

    it('creates a character as player', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      expect(res.body.data.userId).toBe(playerId);
    });

    it('returns 403 when observer tries to create', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', observerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 for invalid payload', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send({ name: '' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when hp exceeds maxHp', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send({ ...VALID_CHARACTER_PAYLOAD, hp: 100, maxHp: 44 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when unauthenticated', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/campaigns/:id/characters
  // -------------------------------------------------------------------------

  describe('GET /api/campaigns/:id/characters', () => {
    it('lists characters in a campaign (plus any global templates)', async () => {
      await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .expect(200);

      const campaignChars = res.body.data.filter(
        (c: { campaignId: string | null }) => c.campaignId === campaignId,
      );
      expect(campaignChars).toHaveLength(1);
      expect(campaignChars[0].name).toBe('Thorin');
    });

    it('returns only global templates when no campaign characters exist', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .expect(200);

      const campaignChars = res.body.data.filter(
        (c: { campaignId: string | null }) => c.campaignId === campaignId,
      );
      expect(campaignChars).toHaveLength(0);
      // Anything else in the list must be a global template
      for (const c of res.body.data) {
        expect(c.campaignId).toBeNull();
      }
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/campaigns/:id/characters/:charId
  // -------------------------------------------------------------------------

  describe('GET /api/campaigns/:id/characters/:charId', () => {
    it('returns character detail', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', dmCookies)
        .expect(200);

      expect(res.body.data.id).toBe(charId);
      expect(res.body.data.abilityScores).toMatchObject(VALID_ABILITY_SCORES);
    });

    it('returns 404 for nonexistent character', async () => {
      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters/nonexistent-id`)
        .set('Cookie', dmCookies)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/campaigns/:id/characters/:charId
  // -------------------------------------------------------------------------

  describe('PUT /api/campaigns/:id/characters/:charId', () => {
    it('allows owner to update their character', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Thorin the Brave', level: 6 })
        .expect(200);

      expect(res.body.data.name).toBe('Thorin the Brave');
      expect(res.body.data.level).toBe(6);
    });

    it('updates skill proficiencies and attacks (Phase 6C)', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ skillProficiencies: ['athletics'], attacks: [VALID_ATTACK] })
        .expect(200);

      expect(res.body.data.skillProficiencies).toEqual(['athletics']);
      expect(res.body.data.attacks).toEqual([VALID_ATTACK]);
    });

    it('rejects duplicate skill proficiencies', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ skillProficiencies: ['stealth', 'stealth'] })
        .expect(400);
    });

    it('allows DM to update any character', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', dmCookies)
        .send({ ac: 20 })
        .expect(200);

      expect(res.body.data.ac).toBe(20);
    });

    it('rejects update from non-owner non-DM', async () => {
      // DM creates a character
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', dmCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      // Player tries to update DM's character
      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ name: 'Hacked' })
        .expect(403);

      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // -------------------------------------------------------------------------
  // Spells & slots (Phase 6D)
  // -------------------------------------------------------------------------

  describe('Spells & slots (Phase 6D)', () => {
    const VALID_SPELL = {
      id: randomUUID(),
      name: 'Magic Missile',
      level: 1,
      prepared: true,
    };
    const VALID_SLOTS = [
      { level: 1, max: 4, used: 1 },
      { level: 2, max: 3, used: 0 },
    ];

    async function createCharacterAsPlayer(): Promise<string> {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);
      return res.body.data.id;
    }

    it('defaults spells and spellSlots to empty arrays on create', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      expect(res.body.data.spells).toEqual([]);
      expect(res.body.data.spellSlots).toEqual([]);
    });

    it('accepts spells and spellSlots on create', async () => {
      const res = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send({ ...VALID_CHARACTER_PAYLOAD, spells: [VALID_SPELL], spellSlots: VALID_SLOTS })
        .expect(201);

      expect(res.body.data.spells).toEqual([VALID_SPELL]);
      expect(res.body.data.spellSlots).toEqual(VALID_SLOTS);
    });

    it('persists spell updates including prepared toggles', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spells: [VALID_SPELL] })
        .expect(200);

      // Toggle prepared off and verify it persists
      const toggled = { ...VALID_SPELL, prepared: false };
      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spells: [toggled] })
        .expect(200);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .expect(200);

      expect(res.body.data.spells).toEqual([toggled]);
    });

    it('persists spell slot usage updates', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spellSlots: [{ level: 3, max: 2, used: 2 }] })
        .expect(200);

      const res = await request(app)
        .get(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .expect(200);

      expect(res.body.data.spellSlots).toEqual([{ level: 3, max: 2, used: 2 }]);
    });

    it('rejects slot usage exceeding max', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spellSlots: [{ level: 1, max: 2, used: 3 }] })
        .expect(400);
    });

    it('rejects duplicate spell slot levels', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({
          spellSlots: [
            { level: 1, max: 2, used: 0 },
            { level: 1, max: 3, used: 0 },
          ],
        })
        .expect(400);
    });

    it('rejects spell levels outside 0-9', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spells: [{ ...VALID_SPELL, level: 10 }] })
        .expect(400);
    });

    it('rejects duplicate spell ids', async () => {
      const charId = await createCharacterAsPlayer();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spells: [VALID_SPELL, { ...VALID_SPELL, name: 'Copy' }] })
        .expect(400);
    });

    it('rejects spell edits on a global template character', async () => {
      const template = await prisma.character.create({
        data: {
          campaignId: null,
          userId: dmId,
          name: 'Template Mage',
          race: 'Elf',
          class: 'Wizard',
          level: 3,
          abilityScores: VALID_ABILITY_SCORES,
          hp: 20,
          maxHp: 20,
        },
      });

      const res = await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${template.id}`)
        .set('Cookie', dmCookies)
        .send({ spells: [VALID_SPELL] })
        .expect(403);

      expect(res.body.error.code).toBe('TEMPLATE_READONLY');
      await prisma.character.delete({ where: { id: template.id } });
    });
  });

  // -------------------------------------------------------------------------
  // Real-time sheet sync (Phase 6D)
  // -------------------------------------------------------------------------

  describe('characters:sheet:updated broadcast (Phase 6D)', () => {
    const emitSpy = vi.fn();
    let toSpy: MockInstance;

    beforeEach(() => {
      emitSpy.mockClear();
      toSpy = vi.spyOn(getIo()!, 'to').mockReturnValue({ emit: emitSpy } as never);
    });

    afterEach(() => {
      toSpy.mockRestore();
    });

    it('broadcasts the full character to the campaign room on owner edit', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);
      const charId = createRes.body.data.id;

      const spells = [{ id: randomUUID(), name: 'Shield', level: 1, prepared: true }];
      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spells })
        .expect(200);

      expect(toSpy).toHaveBeenCalledWith(`campaign:${campaignId}`);
      const sheetCall = emitSpy.mock.calls.find(
        (call) => call[0] === CHARACTER_EVENTS.SHEET_UPDATED,
      );
      expect(sheetCall).toBeDefined();
      expect(sheetCall![1]).toMatchObject({
        campaignId,
        characterId: charId,
        character: { id: charId, spells },
      });
    });

    it('broadcasts on DM edit of another member\u2019s character', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);
      const charId = createRes.body.data.id;
      emitSpy.mockClear();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', dmCookies)
        .send({ spellSlots: [{ level: 1, max: 2, used: 1 }] })
        .expect(200);

      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).toContain(CHARACTER_EVENTS.SHEET_UPDATED);
    });

    it('does not broadcast when validation fails', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);
      const charId = createRes.body.data.id;
      emitSpy.mockClear();

      await request(app)
        .put(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .send({ spellSlots: [{ level: 1, max: 1, used: 2 }] })
        .expect(400);

      const events = emitSpy.mock.calls.map((call) => call[0]);
      expect(events).not.toContain(CHARACTER_EVENTS.SHEET_UPDATED);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/campaigns/:id/characters/:charId/hp
  // -------------------------------------------------------------------------

  describe('PATCH /api/campaigns/:id/characters/:charId/hp', () => {
    it('allows owner to quick-update HP', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/characters/${charId}/hp`)
        .set('Cookie', playerCookies)
        .send({ hp: 20 })
        .expect(200);

      expect(res.body.data.hp).toBe(20);
    });

    it('allows DM to quick-update any character HP', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/characters/${charId}/hp`)
        .set('Cookie', dmCookies)
        .send({ hp: 10 })
        .expect(200);

      expect(res.body.data.hp).toBe(10);
    });

    it('returns 400 for invalid HP value', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/characters/${charId}/hp`)
        .set('Cookie', playerCookies)
        .send({ hp: -5 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when HP exceeds maxHp', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/campaigns/${campaignId}/characters/${charId}/hp`)
        .set('Cookie', playerCookies)
        .send({ hp: 999 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('max HP');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/campaigns/:id/characters/:charId
  // -------------------------------------------------------------------------

  describe('DELETE /api/campaigns/:id/characters/:charId', () => {
    it('allows DM to delete a character', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      await request(app)
        .delete(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', dmCookies)
        .expect(204);

      // Verify deletion
      await request(app)
        .get(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', dmCookies)
        .expect(404);
    });

    it('rejects delete from player', async () => {
      const createRes = await request(app)
        .post(`/api/campaigns/${campaignId}/characters`)
        .set('Cookie', playerCookies)
        .send(VALID_CHARACTER_PAYLOAD)
        .expect(201);

      const charId = createRes.body.data.id;

      await request(app)
        .delete(`/api/campaigns/${campaignId}/characters/${charId}`)
        .set('Cookie', playerCookies)
        .expect(403);
    });

    it('returns 404 for nonexistent character', async () => {
      await request(app)
        .delete(`/api/campaigns/${campaignId}/characters/nonexistent-id`)
        .set('Cookie', dmCookies)
        .expect(404);
    });
  });
});
