import { describe, expect, test } from "bun:test"
import { decodeToken, isExpired } from "./claims"

// an unsigned JWT: only the payload segment matters, nothing here verifies
const jwt = (payload: object) => {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`
}

const location = { url: "https://b", owner: "o", repo: "r", path: "users" }

describe("decodeToken", () => {
  test("reads sub, client, policies and the bridge location", () => {
    // setup: a bridge token as the AS issues it
    const token = jwt({
      sub: "EAID",
      client_id: "https://site.test",
      aud: "https://b",
      exp: 100,
      kerits: { v: 2, policySAIDs: ["E1"], "data-source": { data: location } },
    })
    // call our method under test
    const view = decodeToken(token)
    // assertions: every panel field, and the alias found by its data.url
    expect(view).toEqual({
      sub: "EAID",
      clientId: "https://site.test",
      aud: "https://b",
      exp: 100,
      policySAIDs: ["E1"],
      location,
    })
  })

  test("no alias with data.url gives a null location", () => {
    // setup: signed in without the repo location entry
    const token = jwt({ sub: "EAID", kerits: { v: 2, policySAIDs: [], member: { said: "E1" } } })
    // call our method under test
    const view = decodeToken(token)
    // assertions: decoded, but nothing to read or write against
    expect(view?.location).toBeNull()
  })

  test("a non-JWT is null", () => {
    // setup: garbage in sessionStorage
    // call our method under test
    const view = decodeToken("not-a-jwt")
    // assertions: no view, no throw
    expect(view).toBeNull()
  })
})

describe("isExpired", () => {
  test("compares exp to now in seconds, never expired without exp", () => {
    // setup: a token expiring at 100 and one without exp
    const view = decodeToken(jwt({ sub: "s", exp: 100 }))
    const noExp = decodeToken(jwt({ sub: "s" }))
    if (!view || !noExp) throw new Error("decode failed")
    // call our method under test
    const results = [isExpired(view, 101), isExpired(view, 99), isExpired(noExp, 1e12)]
    // assertions: past exp is expired, before is not, no exp never is
    expect(results).toEqual([true, false, false])
  })
})
