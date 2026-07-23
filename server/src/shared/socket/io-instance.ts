import type { Server } from 'socket.io';

/**
 * Singleton holder for the Socket.IO server instance.
 *
 * REST route handlers use `getIo()` to broadcast events after successful writes,
 * without creating a circular dependency on `app.ts`.
 * `setIo()` is called once during server startup in `app.ts`.
 */
let _io: Server | null = null;

export function setIo(io: Server): void {
  _io = io;
}

export function getIo(): Server | null {
  return _io;
}
