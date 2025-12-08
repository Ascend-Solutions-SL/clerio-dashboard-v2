import { createHmac, randomBytes } from 'crypto';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

const DRIVE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive',
];

const stateSecret = process.env.DRIVE_OAUTH_STATE_SECRET;

if (!stateSecret) {
  throw new Error('DRIVE_OAUTH_STATE_SECRET environment variable is not defined');
}

const assertGoogleCredentials = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
  }
};

export interface DriveOAuthStatePayload {
  userUid: string;
  redirectPath?: string;
  nonce: string;
}

const encodeStatePayload = (payload: DriveOAuthStatePayload) => {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json).toString('base64url');
  const signature = createHmac('sha256', stateSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
};

const decodeStatePayload = (state: string): DriveOAuthStatePayload => {
  const [body, signature] = state.split('.');

  if (!body || !signature) {
    throw new Error('Invalid state received');
  }

  const expectedSignature = createHmac('sha256', stateSecret).update(body).digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('State signature mismatch');
  }

  const json = Buffer.from(body, 'base64url').toString('utf8');
  const payload = JSON.parse(json) as DriveOAuthStatePayload;

  if (!payload?.userUid) {
    throw new Error('Invalid state payload');
  }

  return payload;
};

export const createDriveOAuthState = (userUid: string, redirectPath?: string) =>
  encodeStatePayload({
    userUid,
    redirectPath,
    nonce: randomBytes(8).toString('hex'),
  });

export const parseDriveOAuthState = (state: string) => decodeStatePayload(state);

export const buildDriveOAuthUrl = (params: { state: string; redirectUri: string }) => {
  assertGoogleCredentials();

  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', DRIVE_SCOPES.join(' '));

  return url.toString();
};

export interface GoogleDriveTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
  id_token?: string;
}

export const exchangeDriveCodeForTokens = async (params: { code: string; redirectUri: string }) => {
  assertGoogleCredentials();

  const body = new URLSearchParams({
    code: params.code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange Google Drive auth code: ${errorBody}`);
  }

  return (await response.json()) as GoogleDriveTokenResponse;
};

export const refreshDriveAccessToken = async (refreshToken: string) => {
  assertGoogleCredentials();

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh Google Drive access token: ${errorBody}`);
  }

  return (await response.json()) as GoogleDriveTokenResponse;
};

export interface GoogleDriveUserInfo {
  sub: string;
  email: string;
}

export const fetchDriveUserInfo = async (accessToken: string): Promise<GoogleDriveUserInfo> => {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch Google user info: ${errorBody}`);
  }

  return (await response.json()) as GoogleDriveUserInfo;
};
