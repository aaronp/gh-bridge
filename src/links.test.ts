import { expect, test } from "bun:test"
import { joinRepo, keritsLink, prefillFrom, repoOf, rulesTarget } from "./links"

test("edit link when .kerits exists, create link when it does not", () => {
  // setup: one repo, both states of .kerits
  // call our method under test
  const [edit, create] = [keritsLink("o/r", true), keritsLink("o/r", false)]
  // assertions: GitHub's edit and new-file URLs on the default branch
  expect(edit).toBe("https://github.com/o/r/edit/HEAD/.kerits")
  expect(create).toBe("https://github.com/o/r/new/HEAD?filename=.kerits")
})

test("repo is owner/repo, or a bare name joined with owner, as the bridge reads it", () => {
  // setup: the three shapes a token's data can take
  // call our method under test
  const results = [repoOf({ repo: "o/r" }), repoOf({ owner: "o", repo: "r" }), repoOf({ repo: "r" })]
  // assertions: full owner/repo, or null when the bridge would reject it (invalid_repo)
  expect(results).toEqual(["o/r", "o/r", null])
})

test(".kerits is read without the configured branch", () => {
  // setup: a target naming a repo and a non-default branch
  // call our method under test
  const t = rulesTarget({ repo: "o/r", branch: "draft" })
  // assertions: branch dropped, so the page shows the .kerits the bridge enforces (default branch)
  expect(t).toEqual({ repo: "o/r" })
})

test("owner and repo inputs join to the owner/repo the bridge takes", () => {
  // setup: the input combinations a user can leave
  // call our method under test
  const results = [joinRepo("o", "r"), joinRepo(" o ", " r "), joinRepo("", "o/r"), joinRepo("x", "o/r"), joinRepo("", ""), joinRepo("o", "")]
  // assertions: joined when both set, an owner/repo in the repo box wins, nothing set means the token's repo
  expect(results).toEqual(["o/r", "o/r", "o/r", "o/r", undefined, undefined])
})

test("token location prefills owner, repo and branch", () => {
  // setup: token locations in each shape
  // call our method under test
  const results = [
    prefillFrom({ repo: "o/r", branch: "draft" }),
    prefillFrom({ owner: "o", repo: "r" }),
    prefillFrom({ path: "users" }),
    prefillFrom(null),
  ]
  // assertions: only the values the token discloses, split into owner and repo
  expect(results).toEqual([{ owner: "o", repo: "r", branch: "draft" }, { owner: "o", repo: "r" }, {}, {}])
})
