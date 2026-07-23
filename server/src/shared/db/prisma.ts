import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — import this everywhere, never instantiate a new client
const prisma = new PrismaClient();

export { prisma };
