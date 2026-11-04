import { createGhBridgeClient, type DirRead, type FileRead, type Result } from '@kerits/gh-bridge-client';
import { decodeToken, isExpired, type TokenView } from './claims';
import { keritsLink, repoOf } from './links';
import { authorizeUrl, checkState, exchangeCode, type OAuthConfig, parseCallback, unfilledPlaceholders } from './oauth';
import { challengeFor, randomVerifier } from './pkce';

const CONFIG_KEY = 'gh-bridge-example:config';
const PKCE_KEY = 'gh-bridge-example:pkce';
const TOKEN_KEY = 'gh-bridge-example:token';

const DEFAULT_ENTRIES = JSON.stringify(
  [
    { policy: '<MEMBER_POLICY_SAID>', as: 'member', need: 'required', purpose: 'read the repo' },
    {
      policy: '<REPO_LOCATION_POLICY_SAID>',
      as: 'data',
      need: 'required',
      purpose: 'bridge location',
      audienceFrom: 'data.url',
    },
  ],
  null,
  2,
);

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement | HTMLTextAreaElement>(id);
const show = (id: string, value: unknown) => {
  $(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

// storage can be unavailable (private mode, blocked site data): every access is best-effort
const store = {
  get: (s: Storage, k: string) => {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  set: (s: Storage, k: string, v: string | null) => {
    try {
      v === null ? s.removeItem(k) : s.setItem(k, v);
    } catch {}
  },
};

// --- config ---
const fields = ['asUrl', 'bridgeUrl', 'entries'] as const;
type Fields = Record<(typeof fields)[number], string>;

function loadConfig(): Fields {
  const defaults: Fields = {
    asUrl: import.meta.env.VITE_AS_URL ?? '',
    bridgeUrl: import.meta.env.VITE_BRIDGE_URL ?? '',
    entries: import.meta.env.VITE_ENTRIES || DEFAULT_ENTRIES,
  };
  try {
    return { ...defaults, ...JSON.parse(store.get(localStorage, CONFIG_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

const config = (): OAuthConfig => ({
  asUrl: input('asUrl').value.trim(),
  bridgeUrl: input('bridgeUrl').value.trim(),
  entries: input('entries').value,
  clientId: location.origin,
  redirectUri: location.origin + location.pathname,
});

for (const [k, v] of Object.entries(loadConfig())) input(k).value = v;
for (const k of fields) {
  input(k).addEventListener('change', () => {
    const saved = Object.fromEntries(fields.map((f) => [f, input(f).value]));
    store.set(localStorage, CONFIG_KEY, JSON.stringify(saved));
  });
}

// --- token ---
let token = store.get(sessionStorage, TOKEN_KEY);
let view: TokenView | null = null;

function renderToken() {
  view = token ? decodeToken(token) : null;
  const usable = view?.location != null;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.needsToken')) b.disabled = !usable;
  if (!token) return show('tokenOut', 'Not signed in.');
  if (!view) return show('tokenOut', 'Stored token is not a JWT; sign in again.');
  const status = isExpired(view, Date.now() / 1000) ? 'EXPIRED (the bridge will answer 401)' : 'valid until exp';
  const note = view.location ? '' : '\n\nNo bridge location in token: sign in with the repo-location entry.';
  show('tokenOut', `${JSON.stringify(view, null, 2)}\n\n${status}${note}`);
  renderRulesLink(null);
}

const client = () => createGhBridgeClient({ url: config().bridgeUrl, getToken: () => token ?? '' });

// --- sign in ---
$('signIn').addEventListener('click', async () => {
  const left = unfilledPlaceholders(config().entries);
  if (left.length > 0)
    return show('authOut', `Replace ${left.join(', ')} in the sign-in entries with your policy SAIDs first.`);
  const verifier = randomVerifier();
  const state = randomVerifier();
  store.set(sessionStorage, PKCE_KEY, JSON.stringify({ verifier, state }));
  location.assign(authorizeUrl(config(), await challengeFor(verifier), state));
});

$('signOut').addEventListener('click', () => {
  token = null;
  store.set(sessionStorage, TOKEN_KEY, null);
  renderToken();
});

async function handleCallback() {
  const cb = parseCallback(location.search);
  if (cb.kind === 'none') return;
  history.replaceState(null, '', location.pathname);
  if (cb.kind === 'error') return show('authOut', { error: cb.error, description: cb.description });
  const stored = (() => {
    try {
      return JSON.parse(store.get(sessionStorage, PKCE_KEY) ?? 'null') as { verifier: string; state: string } | null;
    } catch {
      return null;
    }
  })();
  store.set(sessionStorage, PKCE_KEY, null);
  if (!stored || !checkState(cb.state, stored.state)) {
    return show('authOut', 'State mismatch or no pending sign-in in this tab: refusing the code. Sign in again.');
  }
  const result = await exchangeCode(config(), cb.code, stored.verifier);
  if (!result.ok) return show('authOut', result);
  token = result.accessToken;
  store.set(sessionStorage, TOKEN_KEY, token);
  show('authOut', 'Signed in.');
  renderToken();
}

// --- read ---
const lastSha = new Map<string, string>();

function renderRead(path: string, result: Result<FileRead | DirRead>) {
  const list = $('entriesOut');
  list.replaceChildren();
  if (result.ok && result.value.type === 'file') lastSha.set(path, result.value.sha);
  if (result.ok && result.value.type === 'dir') {
    for (const e of result.value.entries) {
      const b = document.createElement('button');
      b.textContent = `${e.type === 'dir' ? '📁' : '📄'} ${e.name}`;
      b.addEventListener('click', () => doRead(e.path));
      list.append(b);
    }
  }
  show('readOut', result);
}

async function doRead(path: string) {
  input('readPath').value = path;
  renderRead(path, await client().read(path || undefined));
}

$('read').addEventListener('click', () => doRead(input('readPath').value.trim()));

// --- write ---
input('writePath').addEventListener('change', () => {
  input('writeSha').value = lastSha.get(input('writePath').value.trim()) ?? '';
});

$('write').addEventListener('click', async () => {
  const path = input('writePath').value.trim();
  const sha = input('writeSha').value.trim();
  const result = await client().write(path, input('writeContent').value, sha ? { sha } : {});
  if (result.ok) {
    lastSha.set(path, result.value.sha);
    input('writeSha').value = result.value.sha;
  }
  $('reread').hidden = result.ok || result.status !== 409;
  show('writeOut', result);
});

$('reread').addEventListener('click', async () => {
  const path = input('writePath').value.trim();
  const result = await client().read(path);
  if (result.ok && result.value.type === 'file') input('writeSha').value = result.value.sha;
  $('reread').hidden = true;
  show('writeOut', result);
});

// --- rules ---
function renderRulesLink(exists: boolean | null) {
  const loc = view?.location;
  const repo = loc ? repoOf(loc) : null;
  const link = $<HTMLAnchorElement>('rulesLink');
  link.hidden = !repo;
  if (repo) {
    // unknown existence → edit link; a 403 no_rules read means it is missing
    link.href = keritsLink(repo, exists ?? true);
    link.textContent = exists === false ? 'Create .kerits on GitHub' : 'Edit .kerits on GitHub';
  }
  // reads are relative to the token root, so .kerits is only reachable from a repo-root token
  const atRoot = !loc || loc.path.replace(/^\/+|\/+$/g, '') === '';
  $('readRules').hidden = !atRoot;
  $('rulesNote').hidden = atRoot;
  $('rulesNote').textContent = atRoot ? '' : 'Token root is not the repo root; open .kerits on GitHub.';
}

$('readRules').addEventListener('click', async () => {
  const result = await client().read('.kerits');
  renderRulesLink(result.ok ? true : result.reason === 'no_rules' ? false : null);
  // GitHub answers 404 both for a missing .kerits and for a repo the App is not installed on
  const hint =
    !result.ok && result.reason === 'no_rules'
      ? '\n\nNo .kerits at the repo root, or the GitHub App is not installed on this repo.'
      : '';
  show('rulesOut', `${JSON.stringify(result, null, 2)}${hint}`);
});

renderToken();
void handleCallback();
