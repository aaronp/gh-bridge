# @kerits/gh-bridge-client

Client for the kerits GitHub bridge. Plain `fetch`, no dependencies, never throws.

A site signs in with a kerits wallet and asks the auth server for a bridge token (RFC 8707 `resource=<bridge URL>`). That
token names the repo (`owner/repo`) and a root path; the client reads and writes paths under that root. A full, runnable
setup (GitHub App, `.kerits` rules, sign-in) is the example template: https://github.com/aaronp/gh-bridge

```ts
import { createGhBridgeClient } from "@kerits/gh-bridge-client"

const bridge = createGhBridgeClient({ url: "https://github-bridge.kerits.id", getToken: () => accessToken })

const r = await bridge.read("notes.json") // relative to the token's root path; omit for the root
if (r.ok && r.value.type === "file") {
  await bridge.write("notes.json", '{"n":2}', { sha: r.value.sha }) // no sha = create
} else if (!r.ok) {
  console.log(r.status, r.error, r.reason)
}
```

## API

`createGhBridgeClient({ url, getToken, fetch? })`

- `url`: the bridge origin.
- `getToken`: returns the bearer access token (sync or async).
- `fetch`: optional; receives a single `Request`, so `(req) => app.handle(req)` works in tests.

| Call | Success `value` |
|---|---|
| `read(path?)` | `{ type: "file", path, sha, content, encoding: "utf-8" \| "base64" }` or `{ type: "dir", path, entries: [{ name, path, type, sha }] }` |
| `write(path, content, { sha?, encoding? })` | `{ path, sha, commit }`. Without `sha` it creates; with it, it updates that exact version. |

Every call returns `Result<T>` = `{ ok: true, value }` or `BridgeError` = `{ ok: false, status, error, reason }`.

## Errors

| status | error | reason | Meaning |
|---|---|---|---|
| 0 | `network` | the fetch error message | Request never reached the bridge (offline, DNS, CORS, `getToken` threw). |
| 400 | `bad_request` | `invalid_body` | Write body rejected. |
| 401 | `unauthorized` | `missing_token`, or a token reason (`missing_sub`, `missing_data`, `ambiguous_data`, `invalid_repo`, `unsupported_kerits_version`, expiry / signature failures) | Token missing or not valid for this bridge. |
| 403 | `forbidden` | `denied` | The repo's `.kerits` rules do not allow this read/write for this token. Also returned for a missing file the caller may not read, and for a symlink to another path. |
| 403 | `forbidden` | `no_rules` | No `.kerits` at the repo root, **or the bridge's GitHub App is not installed on the repo** (GitHub answers 404 for both). Everything is denied. |
| 403 | `forbidden` | `invalid_rules` | `.kerits` is not valid v1 rules: everything is denied. |
| 403 | `forbidden` | `rules_file` | Writes to `.kerits` are never allowed through the bridge; edit it on GitHub. |
| 403 | `forbidden` | `path_outside_root`, `invalid_path`, `invalid_root` | Path escapes or is not valid under the token's root. |
| 404 | `not_found` | `not_found` | No such file (reported only when the rules allow the read). |
| 409 | `conflict` | `stale` | `sha` is not the current version: re-read and retry. |
| 409 | `conflict` | `exists` | Create (no `sha`) on a path that already exists. |
| 413 | `too_large` | `too_large` | File over the GitHub contents limit. |
| 500 | `internal` | `internal` | Unhandled error while serving the request. |
| 502 | `upstream` | `upstream` | GitHub error. |
| 503 | `unavailable` | `rules_unavailable` | The key store needed to resolve `username@policy` rules is unreachable (fails closed). |
| other | `http` | status text, or `invalid_json` | Non-bridge response (proxy page, non-JSON body). |

A misconfigured bridge (e.g. missing `KERI_STORE_URL`) answers a plain-text 500 without CORS headers: from a browser that shows
as status 0 `network`, elsewhere as status 500 `http` `Internal Server Error`.

Contract test, against the real bridge app: `bun test services/adapters-github/tests/client-contract.test.ts`.
