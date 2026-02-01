import { createHmac, randomBytes } from "crypto";

const MICROSOFT_AUTH_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const ONEDRIVE_SCOPES = ["offline_access", "User.Read", "Files.ReadWrite.All", "Sites.ReadWrite.All"];

const stateSecret = process.env.ONEDRIVE_OAUTH_STATE_SECRET;

if (!stateSecret) {
  throw new Error("ONEDRIVE_OAUTH_STATE_SECRET environment variable is not defined");
}

const assertMicrosoftCredentials = () => {
  if (!process.env.ONEDRIVE_CLIENT_ID || !process.env.ONEDRIVE_CLIENT_SECRET) {
    throw new Error("ONEDRIVE_CLIENT_ID and ONEDRIVE_CLIENT_SECRET must be configured");
  }
};

export interface OneDriveOAuthStatePayload {
  userUid: string;
  redirectPath?: string;
  nonce: string;
}

const encodeStatePayload = (payload: OneDriveOAuthStatePayload) => {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json).toString("base64url");
  const signature = createHmac("sha256", stateSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
};

const decodeStatePayload = (state: string): OneDriveOAuthStatePayload => {
  const [body, signature] = state.split(".");

  if (!body || !signature) {
    throw new Error("Invalid state received");
  }

  const expectedSignature = createHmac("sha256", stateSecret).update(body).digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("State signature mismatch");
  }

  const json = Buffer.from(body, "base64url").toString("utf8");
  const payload = JSON.parse(json) as OneDriveOAuthStatePayload;

  if (!payload?.userUid) {
    throw new Error("Invalid state payload");
  }

  return payload;
};

export const createOneDriveOAuthState = (userUid: string, redirectPath?: string) =>
  encodeStatePayload({
    userUid,
    redirectPath,
    nonce: randomBytes(8).toString("hex"),
  });

export const parseOneDriveOAuthState = (state: string) => decodeStatePayload(state);

export const buildOneDriveOAuthUrl = async (params: { state: string; redirectUri: string }) => {
  assertMicrosoftCredentials();

  const url = new URL(MICROSOFT_AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.ONEDRIVE_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", ONEDRIVE_SCOPES.join(" "));
  url.searchParams.set("state", params.state);

  return url.toString();
};

export interface OneDriveTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
}

export const exchangeOneDriveCodeForTokens = async (params: { code: string; redirectUri: string }) => {
  assertMicrosoftCredentials();

  const body = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID!,
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code: params.code,
  });

  const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to exchange OneDrive auth code: ${errorBody}`);
  }

  return (await response.json()) as OneDriveTokenResponse;
};

export const refreshOneDriveAccessToken = async (refreshToken: string) => {
  assertMicrosoftCredentials();

  const body = new URLSearchParams({
    client_id: process.env.ONEDRIVE_CLIENT_ID!,
    client_secret: process.env.ONEDRIVE_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: ONEDRIVE_SCOPES.join(' '),
  });

  const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to refresh OneDrive access token: ${errorBody}`);
  }

  return (await response.json()) as OneDriveTokenResponse;
};

export interface OneDriveUserProfile {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
}

export const fetchOneDriveProfile = async (accessToken: string): Promise<OneDriveUserProfile> => {
  const response = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch OneDrive profile: ${errorBody}`);
  }

  return (await response.json()) as OneDriveUserProfile;
};

export interface OneDriveDriveInfo {
  id: string;
  driveType?: string;
  name?: string;
  createdDateTime?: string;
}

export const fetchOneDriveDriveInfo = async (accessToken: string): Promise<OneDriveDriveInfo> => {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/drive", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch OneDrive drive info: ${errorBody}`);
  }

  return (await response.json()) as OneDriveDriveInfo;
};
