/** Fetch-only client for the kerits GitHub bridge (`GET` / `PUT /data`). Never throws for HTTP or network errors. */

export type FileRead = { type: 'file'; path: string; sha: string; content: string; encoding: 'utf-8' | 'base64' };
export type DirRead = {
  type: 'dir';
  path: string;
  entries: { name: string; path: string; type: string; sha: string }[];
};
export type WriteResult = { path: string; sha: string; commit: string };
export type BridgeError = { ok: false; status: number; error: string; reason: string };
export type Result<T> = { ok: true; value: T } | BridgeError;

export function createGhBridgeClient(opts: {
  url: string;
  getToken: () => string | Promise<string>;
  /** Defaults to `globalThis.fetch`; called with a single `Request` (so `app.handle` fits). */
  fetch?: (req: Request) => Promise<Response>;
}) {
  const doFetch = opts.fetch ?? ((req: Request) => globalThis.fetch(req));
  const base = opts.url.replace(/\/+$/, '');

  async function call<T>(method: 'GET' | 'PUT', query: string, body?: unknown): Promise<Result<T>> {
    let res: Response;
    try {
      const headers: Record<string, string> = { authorization: `Bearer ${await opts.getToken()}` };
      if (body !== undefined) headers['content-type'] = 'application/json';
      res = await doFetch(
        new Request(`${base}/data${query}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    } catch (e) {
      return { ok: false, status: 0, error: 'network', reason: e instanceof Error ? e.message : String(e) };
    }
    const json: unknown = await res.json().catch(() => undefined);
    if (res.ok) {
      if (json === undefined) return { ok: false, status: res.status, error: 'http', reason: 'invalid_json' };
      return { ok: true, value: json as T };
    }
    const e = (json ?? {}) as { error?: unknown; reason?: unknown };
    return {
      ok: false,
      status: res.status,
      error: typeof e.error === 'string' ? e.error : 'http',
      reason: typeof e.reason === 'string' ? e.reason : res.statusText || String(res.status),
    };
  }

  return {
    read: (path?: string, o: { repo?: string; branch?: string } = {}) => {
      const q = new URLSearchParams();
      if (path) q.set('path', path);
      if (o.repo) q.set('repo', o.repo);
      if (o.branch) q.set('branch', o.branch);
      const qs = q.toString();
      return call<FileRead | DirRead>('GET', qs ? `?${qs}` : '');
    },
    write: (
      path: string,
      content: string,
      o: { sha?: string; encoding?: 'utf-8' | 'base64'; repo?: string; branch?: string } = {},
    ) => call<WriteResult>('PUT', '', { path, content, ...o }),
  };
}
