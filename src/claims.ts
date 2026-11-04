export type BridgeLocation = { url: string; owner?: string; repo: string; path: string };

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

/** The bridge alias is whichever `kerits` entry discloses `data.url`. */
function locationOf(kerits: unknown): BridgeLocation | null {
  if (!isObject(kerits)) return null;
  for (const v of Object.values(kerits)) {
    const d = isObject(v) ? v.data : undefined;
    if (isObject(d) && typeof d.url === 'string' && typeof d.repo === 'string') {
      return {
        url: d.url,
        ...(typeof d.owner === 'string' ? { owner: d.owner } : {}),
        repo: d.repo,
        path: typeof d.path === 'string' ? d.path : '',
      };
    }
  }
  return null;
}

/** Display only: the bridge verifies the token, the page never does. */
export function decodeToken(jwt: string): TokenView | null {
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
    location: locationOf(kerits),
  };
}

export const isExpired = (view: TokenView, nowSec: number): boolean => view.exp !== null && nowSec > view.exp;
