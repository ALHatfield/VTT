/**
 * Auth Types
 * Shared between client and server
 */

/**
 * User data returned from auth endpoints (no sensitive data)
 */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

/**
 * Login request payload
 */
export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Session data stored server-side
 */
export interface SessionData {
  userId: string;
  email: string;
  username: string;
}

/**
 * Auth response from login endpoint
 */
export interface AuthResponse {
  user: AuthUser;
}
