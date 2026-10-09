import type { Server, Socket } from 'socket.io';

import type { ChatReceivedPayload } from '@vtt/shared';
import {
    CHAT_EVENTS,
    DICE_EVENTS,
    DICE_ROLL_COOLDOWN_MS,
    PLAY_AREA_EVENTS,
    diceRollPayloadSchema,
} from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { parseDiceFormula, rollDiceFormula } from './dice.service.js';

/**
 * Registers dice Socket.IO handlers for a connected socket.
 *
 * Relies on the play-area room join having set `socket.data.campaignId` and
 * `socket.data.campaignRole`. Roll results are persisted and broadcast as
 * `roll` chat messages.
 */
export function registerDiceHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;
  const username = socket.data.username as string;

  const handleRoll = async (rawPayload: unknown): Promise<void> => {
    try {
      const parsed = diceRollPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid dice roll payload',
        });
        return;
      }

      const { campaignId, formula, label } = parsed.data;

      // Guard: must have joined this campaign room
      if (campaignId !== socket.data.campaignId) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'You have not joined this campaign room',
        });
        return;
      }

      // Guard: observers are read-only — dice rolls persist messages
      const role = socket.data.campaignRole as string | undefined;
      if (role === 'observer') {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'FORBIDDEN',
          message: 'Observers cannot roll dice',
        });
        return;
      }

      // Guard: one roll at a time per user — reject rapid-fire rolls
      const lastRollAt = socket.data.lastDiceRollAt as number | undefined;
      const now = Date.now();
      if (lastRollAt !== undefined && now - lastRollAt < DICE_ROLL_COOLDOWN_MS) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'ROLL_IN_PROGRESS',
          message: 'Wait for your previous roll to finish',
        });
        return;
      }

      const parsedFormula = parseDiceFormula(formula);
      if (!parsedFormula) {
        socket.emit(PLAY_AREA_EVENTS.ERROR, {
          code: 'INVALID_FORMULA',
          message: `Cannot parse dice formula: "${formula}"`,
        });
        return;
      }

      socket.data.lastDiceRollAt = now;
      const rollResult = rollDiceFormula(parsedFormula);
      if (label !== undefined) rollResult.label = label;

      const row = await prisma.campaignMessage.create({
        data: {
          campaignId,
          userId,
          username,
          text: formula,
          type: 'roll',
          // Prisma requires InputJsonValue — spread into a plain object to satisfy the index signature
          rollData: { ...rollResult },
        },
      });

      const chatPayload: ChatReceivedPayload = {
        message: {
          id: row.id,
          campaignId: row.campaignId,
          userId: row.userId,
          username: row.username,
          text: row.text,
          type: 'roll',
          rollData: rollResult,
          createdAt: row.createdAt.toISOString(),
        },
      };

      const room = `campaign:${campaignId}`;
      io.to(room).emit(CHAT_EVENTS.CHAT_RECEIVED, chatPayload);
    } catch (err) {
      console.error('[dice socket] dice:roll error', err);
      socket.emit(PLAY_AREA_EVENTS.ERROR, {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process dice roll',
      });
    }
  };

  socket.on(DICE_EVENTS.DICE_ROLL, handleRoll);
  socket.on(DICE_EVENTS.DICE_ROLL_LEGACY, handleRoll);
}
