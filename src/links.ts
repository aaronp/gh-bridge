/** `owner/repo` as the bridge reads the token: `repo` is `owner/repo`, or a bare name joined with `owner`. */
export function repoOf(loc: { owner?: string; repo: string }): string | null {
  const repo = loc.owner && !loc.repo.includes('/') ? `${loc.owner}/${loc.repo}` : loc.repo;
  return /^[^/]+\/[^/]+$/.test(repo) ? repo : null;
}

/** `.kerits` is never written through the bridge: edit it on GitHub (HEAD = default branch). */
export const keritsLink = (repo: string, exists: boolean): string =>
  exists ? `https://github.com/${repo}/edit/HEAD/.kerits` : `https://github.com/${repo}/new/HEAD?filename=.kerits`;
