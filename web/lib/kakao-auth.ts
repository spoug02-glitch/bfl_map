const AUTH_URL = "https://kauth.kakao.com/oauth/authorize";
const TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const USERINFO_URL = "https://kapi.kakao.com/v2/user/me";

function clientId(): string {
  // Kakao calls this the REST API key; it doubles as the OAuth client id.
  const v = process.env.KAKAO_REST_API_KEY;
  if (!v) throw new Error("KAKAO_REST_API_KEY is not set");
  return v;
}

export function redirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/kakao/callback`;
}

export function buildAuthorizeUrl(baseUrl: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    // Only the nickname — this app never needs an email or a profile image.
    scope: "profile_nickname",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

export async function exchangeToken(baseUrl: string, code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    redirect_uri: redirectUri(baseUrl),
    code,
  });
  // The client secret is optional in Kakao and only sent when the app enables it.
  const secret = process.env.KAKAO_CLIENT_SECRET;
  if (secret) body.set("client_secret", secret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
  });
  if (!res.ok) throw new Error(`kakao token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("kakao token response missing access_token");
  return data.access_token;
}

export async function fetchKakaoUser(
  accessToken: string,
): Promise<{ userId: string; nickname: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
  });
  if (!res.ok) throw new Error(`kakao user/me failed: ${res.status}`);
  const data = (await res.json()) as {
    id: number;
    properties?: { nickname?: string };
    kakao_account?: { profile?: { nickname?: string } };
  };
  const nickname =
    data.kakao_account?.profile?.nickname ?? data.properties?.nickname ?? "익명";
  return { userId: String(data.id), nickname };
}
