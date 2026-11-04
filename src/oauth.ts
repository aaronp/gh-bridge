export type OAuthConfig = { asUrl: string; bridgeUrl: string; entries: string; clientId: string; redirectUri: string };

export type Callback =
  | { kind: 'none' }
  | { kind: 'error'; error: string; description?: string }
  | { kind: 'code'; code: string; state: string };

export type Exchange = { ok: true; accessToken: string } | { ok: false; error: string; description?: string };

/** Authorization code + PKCE request; `entries` names the policies and the repo location to disclose. */
export function authorizeUrl(cfg: OAuthConfig, challenge: string, state: string): string {
  const url = new URL('/authorize', cfg.asUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    scope: 'openid',
    entries: cfg.entries,
  }).toString();
  return url.toString();
}

export function parseCallback(search: string): Callback {
  const q = new URLSearchParams(search);
  const error = q.get('error');
  const description = q.get('error_description');
  if (error) return { kind: 'error', error, ...(description ? { description } : {}) };
  const code = q.get('code');
  const state = q.get('state');
  return code && state ? { kind: 'code', code, state } : { kind: 'none' };
}

/** `<..._SAID>` placeholders left in the entries: the AS would answer with a JSON error page and never redirect back. */
export const unfilledPlaceholders = (entries: string): string[] => entries.match(/<[A-Z_]+_SAID>/g) ?? [];

export const checkState = (returned: string, stored: string | null): boolean => stored !== null && returned === stored;

/** RFC 8707: `resource` makes the token's audience the bridge. Never throws. */
export async function exchangeCode(
  cfg: OAuthConfig,
  code: string,
  verifier: string,
  fetch: (req: Request) => Promise<Response> = (req) => globalThis.fetch(req),
): Promise<Exchange> {
  const req = new Request(new URL('/token', cfg.asUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier,
      resource: cfg.bridgeUrl,
    }).toString(),
  });
  let res: Response;
  try {
    res = await fetch(req);
  } catch (e) {
    return { ok: false, error: 'network', description: e instanceof Error ? e.message : String(e) };
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
  };
  if (res.ok && typeof body.access_token === 'string') return { ok: true, accessToken: body.access_token };
  return {
    ok: false,
    error: typeof body.error === 'string' ? body.error : `http_${res.status}`,
    ...(typeof body.error_description === 'string' ? { description: body.error_description } : {}),
  };
}
