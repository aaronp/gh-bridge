import { expect, test } from "bun:test"
import { keritsLink, repoOf } from "./links"

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
