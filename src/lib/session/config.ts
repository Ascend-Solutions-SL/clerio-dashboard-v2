import type { SessionOptions } from 'iron-session';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  businessName: string;
  empresaId: string | null;
  role: string;
  phone: string;
}

export interface SessionData {
  user?: SessionUser;
  lastActivity?: number;
}

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser;
    lastActivity?: number;
  }
}

const sessionPassword = process.env.IRON_SESSION_PASSWORD;

if (!sessionPassword) {
  throw new Error('IRON_SESSION_PASSWORD environment variable is not defined');
}

export const SESSION_IDLE_TIMEOUT_SECONDS = 60 * 60; // 1 hour
export const SESSION_REFRESH_THRESHOLD_SECONDS = 15 * 60; // 15 minutes

export const sessionOptions: SessionOptions = {
  cookieName: 'clerio_session',
  password: sessionPassword,
  ttl: SESSION_IDLE_TIMEOUT_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  },
};
