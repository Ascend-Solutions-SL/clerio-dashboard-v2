import { createHmac, randomBytes } from "crypto";

const OUTLOOK_AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const OUTLOOK_SCOPES = ["offline_access", "User.Read", "Mail.ReadWrite", "Mail.ReadWrite.Shared"];

const outlookStateSecret = process.env.OUTLOOK_OAUTH_STATE_SECRET;

if (!outlookStateSecret) {
  throw new Error("OUTLOOK_OAUTH_STATE_SECRET environment variable is not defined");
}

const assertOutlookCredentials = () => {
  if (!process.env.OUTLOOK_CLIENT_ID || !process.env.OUTLOOK_CLIENT_SECRET) {
    throw new Error("OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET must be configured");
  }
};

export interface OutlookOAuthStatePayload {
  userUid: string;
  redirectPath?: string;
  nonce: string;
}

const encodeStatePayload = (payload: OutlookOAuthStatePayload) => {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json).toString("base64url");
  const signature = createHmac("sha256", outlookStateSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
};

const decodeStatePayload = (state: string): OutlookOAuthStatePayload => {
  const [body, signature] = state.split(".");

  if (!body || !signature) {
    throw new Error("Invalid state received");
  }

  const expectedSignature = createHmac("sha256", outlookStateSecret).update(body).digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("State signature mismatch");
  }

  const json = Buffer.from(body, "base64url").toString("utf8");
  const payload = JSON.parse(json) as OutlookOAuthStatePayload;

  if (!payload?.userUid) {
    throw new Error("Invalid state payload");
  }

  return payload;
};

export const createOutlookOAuthState = (userUid: string, redirectPath?: string) =>
  encodeStatePayload({
    userUid,
    redirectPath,
    nonce: randomBytes(8).toString("hex"),
  });

export const parseOutlookOAuthState = (state: string) => decodeStatePayload(state);

export const buildOutlookOAuthUrl = async (params: { state: string; redirectUri: string }) => {
  assertOutlookCredentials();

  const url = new URL(OUTLOOK_AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.OUTLOOK_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
  url.searchParams.set("state", params.state);

  return url.toString();
};

export interface OutlookTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
}

export const exchangeOutlookCodeForTokens = async (params: { code: string; redirectUri: string }) => {
  assertOutlookCredentials();

  const body = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const response = await fetch(OUTLOOK_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange Outlook auth code: ${errorBody}`);
  }

  return (await response.json()) as OutlookTokenResponse;
};

interface OutlookProfile {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

export const fetchOutlookProfile = async (accessToken: string): Promise<OutlookProfile> => {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch Outlook profile: ${errorBody}`);
  }

  return (await response.json()) as OutlookProfile;
};
