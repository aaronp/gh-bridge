/** `owner/repo` as the bridge reads the token: `repo` is `owner/repo`, or a bare name joined with `owner`. */
export function repoOf(loc: { owner?: string; repo?: string }): string | null {
  if (!loc.repo) return null;
  const repo = loc.owner && !loc.repo.includes('/') ? `${loc.owner}/${loc.repo}` : loc.repo;
  return /^[^/]+\/[^/]+$/.test(repo) ? repo : null;
}

/** `.kerits` is never written through the bridge: edit it on GitHub (HEAD = default branch). */
export const keritsLink = (repo: string, exists: boolean): string =>
  exists ? `https://github.com/${repo}/edit/HEAD/.kerits` : `https://github.com/${repo}/new/HEAD?filename=.kerits`;

/** The bridge loads `.kerits` from the default branch only, so it is read without the configured branch. */
export const rulesTarget = ({ repo }: { repo?: string; branch?: string }): { repo?: string } => ({ repo });

/** The owner/repo inputs as the bridge's `repo`: an `owner/repo` in the repo box wins; nothing set = the token's repo. */
export function joinRepo(owner: string, repo: string): string | undefined {
  const [o, r] = [owner.trim(), repo.trim()];
  if (r.includes('/')) return r;
  return o && r ? `${o}/${r}` : undefined;
}

/** The inputs a token's disclosed location fills in after sign-in (the user can still change them). */
export function prefillFrom(loc: { owner?: string; repo?: string; branch?: string; path?: string } | null): {
  owner?: string;
  repo?: string;
  branch?: string;
} {
  const full = loc ? repoOf(loc) : null;
  const [owner, repo] = full ? full.split('/') : [];
  return { ...(owner && repo ? { owner, repo } : {}), ...(loc?.branch ? { branch: loc.branch } : {}) };
}
