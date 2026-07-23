import type { AuthUser } from '@vtt/shared';
import { prisma } from '../../shared/db/prisma.js';
import { verifyPassword } from '../../shared/utils/password.js';

/**
 * Authenticate user with email and password
 * Returns user data if credentials are valid
 * Throws on invalid credentials with generic error message
 */
export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthUser> {
  // Find user by email (case-insensitive)
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Generic error to prevent account enumeration
  if (!user) {
    throw new Error('Invalid username or password');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid username or password');
  }

  // Return user data without sensitive fields
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

/**
 * Get user by ID
 * Returns null if user not found
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}
