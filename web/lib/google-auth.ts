const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}

function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

export function redirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/google/callback`;
}

export function buildAuthorizeUrl(baseUrl: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: "openid profile",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

export async function exchangeToken(baseUrl: string, code: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(baseUrl),
      code,
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("google token response missing access_token");
  return data.access_token;
}

export async function fetchGoogleUser(accessToken: string): Promise<{ userId: string; nickname: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
  const data = (await res.json()) as { sub: string; name?: string };
  return { userId: data.sub, nickname: data.name ?? "익명" };
}
