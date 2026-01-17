export const AUTH_ACTIVITY_COOKIE_NAME = 'clerio_auth_activity';

export const DEFAULT_IDLE_TIMEOUT_SECONDS = 5 * 60;
export const DEFAULT_MAX_SESSION_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

type Payload = {
  la: number;
  ss: number;
};

const base64UrlEncode = (bytes: ArrayBuffer) => {
  const str = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlEncodeString = (value: string) => {
  const bytes = encoder.encode(value);
  return base64UrlEncode(bytes.buffer);
};

const base64UrlDecodeToString = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const getSecret = () => {
  const secret = process.env.AUTH_ACTIVITY_COOKIE_SECRET ?? process.env.IRON_SESSION_PASSWORD;
  if (!secret) {
    throw new Error('Missing AUTH_ACTIVITY_COOKIE_SECRET');
  }
  return secret;
};

const importKey = async (secret: string) => {
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
};

const sign = async (data: string, secret: string) => {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(signature);
};

export const getAuthActivityConfig = () => {
  const idleTimeoutSecondsRaw = process.env.AUTH_IDLE_TIMEOUT_SECONDS;
  const maxSessionSecondsRaw = process.env.AUTH_MAX_SESSION_SECONDS;

  const idleTimeoutSeconds = idleTimeoutSecondsRaw ? Number(idleTimeoutSecondsRaw) : DEFAULT_IDLE_TIMEOUT_SECONDS;
  const maxSessionSeconds = maxSessionSecondsRaw ? Number(maxSessionSecondsRaw) : DEFAULT_MAX_SESSION_SECONDS;

  return {
    idleTimeoutSeconds: Number.isFinite(idleTimeoutSeconds) && idleTimeoutSeconds > 0 ? idleTimeoutSeconds : DEFAULT_IDLE_TIMEOUT_SECONDS,
    maxSessionSeconds: Number.isFinite(maxSessionSeconds) && maxSessionSeconds > 0 ? maxSessionSeconds : DEFAULT_MAX_SESSION_SECONDS,
  };
};

export const encodeAuthActivityCookie = async (payload: Payload) => {
  const secret = getSecret();
  const json = JSON.stringify(payload);
  const data = base64UrlEncodeString(json);
  const signature = await sign(data, secret);
  return `${data}.${signature}`;
};

export const decodeAuthActivityCookie = async (value: string) => {
  const secret = getSecret();
  const [data, sig] = value.split('.', 2);
  if (!data || !sig) {
    return null;
  }
  const expected = await sign(data, secret);
  if (!timingSafeEqual(expected, sig)) {
    return null;
  }

  try {
    const json = base64UrlDecodeToString(data);
    const parsed = JSON.parse(json) as Partial<Payload>;
    if (typeof parsed.la !== 'number' || typeof parsed.ss !== 'number') {
      return null;
    }
    return { la: parsed.la, ss: parsed.ss };
  } catch {
    return null;
  }
};
