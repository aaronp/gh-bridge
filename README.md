# gh-bridge example

A minimal web page that signs in with a kerits wallet and reads and writes files in a GitHub repo through the kerits GitHub bridge.
Clone it as the starting point for your own site.

```
wallet → auth server (oauth.kerits.id) → this page (bridge token) → GitHub bridge → GitHub
```

The page has no secrets and no GitHub credentials. It uses plain browser OAuth (authorization code + PKCE) and
[`@kerits/gh-bridge-client`](./gh-bridge-client/README.md), vendored in `./gh-bridge-client` so `bun install` needs nothing else
of ours. Who may read and write what is decided by a `.kerits` file in the repo, which only the repo owner can change.

## Setup

### 1. Prerequisites

- [Bun](https://bun.sh).
- A kerits wallet identity: sign-in redirects to the wallet, where you approve what the page asks for.
- A GitHub repo you own.

### 2. Install the GitHub App on the repo

The bridge talks to GitHub as a GitHub App. Whoever runs the bridge creates it once (permissions **Contents: Read & write**,
**Metadata: Read**, no webhooks). Install it on the repo under **Only select repositories**. The bridge serves exactly the repos the App is
installed on. If you run your own bridge, see its README (`services/adapters-github/README.md`, section 1) for creating the
App and its key. The bridge's `KERI_STORE_URL` is where `username@policy` names in your rules are looked up
(`https://data.kerits.id` in production).

### 3. Publish two policies

In the kerits web app's policy editor, publish:

- **member**: who may use your repo (e.g. holders of a membership credential you issue). Note its SAID and the name you published
  it under, `<username>@member`.
- **repo location**: a self-asserted policy disclosing the fields `url`, `owner`, `repo`, `path`. At sign-in the user fills these
  in: `url` = the bridge URL, `owner`/`repo` = your repo (or `repo` = `owner/repo`), `path` = the root the token may reach (`/` for
  the whole repo). Note its SAID.

### 4. Commit a `.kerits` file at the repo root

Without it the bridge denies everything (`403 no_rules`). Still `no_rules` after committing it? The GitHub App is not installed
on the repo (step 2): GitHub answers 404 for both. Example: members read `/shared/**`, and each user writes only their own
folder under `/users/<their AID>/`:

```json
{
  "v": 1,
  "rules": {
    "/shared/{rest=**}": { "read": ["<username>@member"] },
    "/users/{aid}/{rest=**}": { "read": ["<username>@member"], "write": "auth.subject == aid" }
  }
}
```

- A **list** allows anyone whose token holds one of those policies (`username@name` or a raw policy SAID).
- A **string** is a condition over `auth.subject` (the user's AID), `auth.clientId` (the site, e.g. `'https://foo.com'`),
  `auth.policySAIDs`, and the pattern's variables.
- Rules cannot read other files. `.kerits` itself can never be written through the bridge: change it with a normal commit. To read
  it from this page, add a rule that allows it, e.g. `"/.kerits": { "read": ["<username>@member"] }`.

### 5. Configure and run the page

No site registration is needed: the auth server uses the page's origin as its client id, and the redirect URI is the page itself
(it must be HTTPS, or `http://localhost`).

```bash
cp .env.example .env   # set VITE_BRIDGE_URL; optionally VITE_AS_URL and VITE_ENTRIES
make install           # or: bun install
make dev               # http://localhost:5175
```

In the page's **Config**, set the bridge URL and replace `<MEMBER_POLICY_SAID>` and `<REPO_LOCATION_POLICY_SAID>` in the sign-in
entries with the SAIDs from step 3 (the page refuses to sign in while a placeholder is left). Config is saved in your browser.

### 6. Try it

1. **Sign in.** Approve in the wallet, filling in the repo location. Back on the page, **Token** shows your AID, the site, your
   policies and the `owner/repo/path` the token is for.
2. **Read** with an empty path to list the token root; click entries to open them.
3. **Write** a file under `users/<your AID>/`. A read of the same path fills in its `sha`; without one the write creates. A `409
   stale` means someone changed it: press **Re-read** and write again.
4. **Rules**: read `.kerits` (when your token root is `/` and a rule allows it) or open it on GitHub to edit. Then repeat 2–3.
   - A `.kerits` edit applies on the next request.
   - Republishing a policy name (pointing `<username>@member` at a different policy) takes up to ~120 s.
5. Sign in without the member policy (remove that entry) to see `403 denied`.

Every result is shown as returned by the client: `{ ok: true, value }` or `{ ok: false, status, error, reason }`. See the
[client README](./gh-bridge-client/README.md) for what each status and reason means.

## Develop

```bash
make test       # unit tests (PKCE, OAuth, token decode, links)
make typecheck
make build      # static site in dist/
```

`gh-bridge-client/` is a copy of the client, synced from the kerits monorepo: change it there, not here.
