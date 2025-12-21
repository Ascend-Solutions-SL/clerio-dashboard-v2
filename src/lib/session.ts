import type { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';

import {
  sessionOptions,
  type SessionData,
  type SessionUser,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
} from './session/config';
import { ENV } from './config';

export const getRouteSession = (request: NextRequest, response: NextResponse) =>
  getIronSession<SessionData>(request, response, sessionOptions);

export const resolveLoginUrl = () =>
  process.env.CLERIO_LOGIN_URL || ENV.APP_BASE_URL || 'https://clerio-login.vercel.app';

export {
  sessionOptions,
  type SessionData,
  type SessionUser,
  SESSION_REFRESH_THRESHOLD_SECONDS,
  SESSION_IDLE_TIMEOUT_SECONDS,
};
