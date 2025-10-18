import type { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';

import {
  sessionOptions,
  type SessionData,
  type SessionUser,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
} from './session/config';

const DEFAULT_LOGIN_URL = 'https://clerio-login.vercel.app';

export const getRouteSession = (request: NextRequest, response: NextResponse) =>
  getIronSession<SessionData>(request, response, sessionOptions);

export const resolveLoginUrl = () => process.env.CLERIO_LOGIN_URL ?? DEFAULT_LOGIN_URL;

export {
  sessionOptions,
  type SessionData,
  type SessionUser,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
};
