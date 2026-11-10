export type BridgeLocation = { url?: string; owner?: string; repo?: string; branch?: string; path?: string };

export type TokenView = {
  sub: string;
  clientId: string | null;
  aud: string | string[];
  exp: number | null;
  policySAIDs: string[];
  location: BridgeLocation | null;
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function payloadOf(jwt: string): Record<string, unknown> | null {
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    return isObject(json) ? json : null;
  } catch {
    return null;
  }
}

const LOCATION_KEYS = ['url', 'owner', 'repo', 'branch', 'path'] as const;

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Similar to the bridge's rule (display only, first match wins): the first alias disclosing any location key, unless its `url` is not a string or names another origin. */
function locationOf(kerits: unknown, bridgeUrl: string): BridgeLocation | null {
  if (!isObject(kerits)) return null;
  for (const v of Object.values(kerits)) {
    const d = isObject(v) ? v.data : undefined;
    if (!isObject(d) || !LOCATION_KEYS.some((k) => k in d)) continue;
    if ('url' in d && !(typeof d.url === 'string' && sameOrigin(d.url, bridgeUrl))) continue;
    return Object.fromEntries(LOCATION_KEYS.flatMap((k) => (typeof d[k] === 'string' ? [[k, d[k]]] : [])));
  }
  return null;
}

/** Display only: the bridge verifies the token, the page never does. */
export function decodeToken(jwt: string, bridgeUrl: string): TokenView | null {
  const p = payloadOf(jwt);
  if (!p) return null;
  const kerits = isObject(p.kerits) ? p.kerits : {};
  const aud = p.aud;
  return {
    sub: typeof p.sub === 'string' ? p.sub : '',
    clientId: typeof p.client_id === 'string' ? p.client_id : null,
    aud: typeof aud === 'string' || Array.isArray(aud) ? (aud as string | string[]) : '',
    exp: typeof p.exp === 'number' ? p.exp : null,
    policySAIDs: Array.isArray(kerits.policySAIDs)
      ? kerits.policySAIDs.filter((s): s is string => typeof s === 'string')
      : [],
    location: locationOf(kerits, bridgeUrl),
  };
}

export const isExpired = (view: TokenView, nowSec: number): boolean => view.exp !== null && nowSec > view.exp;
