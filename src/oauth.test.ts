import { describe, expect, test } from "bun:test"
import { type OAuthConfig, authorizeUrl, checkState, exchangeCode, parseCallback, unfilledPlaceholders } from "./oauth"

const cfg: OAuthConfig = {
  asUrl: "https://as.test",
  bridgeUrl: "https://bridge.test",
  entries: '[{"policy":"E1","as":"member","need":"required","purpose":"p"}]',
  clientId: "https://site.test",
  redirectUri: "https://site.test/",
}

describe("authorizeUrl", () => {
  test("carries every code + PKCE param and the entries", () => {
    // setup: a fixed config, challenge and state
    // call our method under test
    const url = new URL(authorizeUrl(cfg, "CH", "ST"))
    // assertions: the AS authorize endpoint with each required param
    expect(url.origin + url.pathname).toBe("https://as.test/authorize")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "https://site.test",
      redirect_uri: "https://site.test/",
      code_challenge: "CH",
      code_challenge_method: "S256",
      state: "ST",
      scope: "openid",
      entries: cfg.entries,
    })
  })
})

describe("parseCallback", () => {
  test("error, code and empty returns", () => {
    // setup: the three shapes a redirect back can take
    // call our method under test
    const [err, code, none] = ["?error=access_denied&error_description=no", "?code=c&state=s", ""].map(parseCallback)
    // assertions: each maps to its kind
    expect(err).toEqual({ kind: "error", error: "access_denied", description: "no" })
    expect(code).toEqual({ kind: "code", code: "c", state: "s" })
    expect(none).toEqual({ kind: "none" })
  })
})

describe("checkState", () => {
  test("only an exact match with a stored state passes", () => {
    // setup: matching, missing and different stored states
    // call our method under test
    const results = [checkState("s", "s"), checkState("s", null), checkState("s", "t")]
    // assertions: a missing or different state refuses the exchange
    expect(results).toEqual([true, false, false])
  })
})

describe("exchangeCode", () => {
  test("posts the form with resource and returns the access token", async () => {
    // setup: a stub token endpoint that records the request
    let seen: Request | undefined
    const fetch = async (req: Request) => {
      seen = req
      return Response.json({ access_token: "AT" })
    }
    // call our method under test
    const result = await exchangeCode(cfg, "CODE", "VER", fetch)
    // assertions: a form POST to /token with all six fields, and the token back
    expect(result).toEqual({ ok: true, accessToken: "AT" })
    expect(seen?.method).toBe("POST")
    expect(seen?.url).toBe("https://as.test/token")
    expect(seen?.headers.get("content-type")).toBe("application/x-www-form-urlencoded")
    expect(Object.fromEntries(new URLSearchParams(await seen?.text()))).toEqual({
      grant_type: "authorization_code",
      code: "CODE",
      redirect_uri: "https://site.test/",
      client_id: "https://site.test",
      code_verifier: "VER",
      resource: "https://bridge.test",
    })
  })

  test("an OAuth error body is returned, not thrown", async () => {
    // setup: the AS rejects the grant
    const fetch = async () => Response.json({ error: "invalid_grant", error_description: "used" }, { status: 400 })
    // call our method under test
    const result = await exchangeCode(cfg, "CODE", "VER", fetch)
    // assertions: the error code and description surface
    expect(result).toEqual({ ok: false, error: "invalid_grant", description: "used" })
  })

  test("a network failure is returned as error network", async () => {
    // setup: fetch rejects
    const fetch = async (): Promise<Response> => {
      throw new TypeError("offline")
    }
    // call our method under test
    const result = await exchangeCode(cfg, "CODE", "VER", fetch)
    // assertions: no throw, a typed network error
    expect(result).toEqual({ ok: false, error: "network", description: "offline" })
  })
})

describe("unfilledPlaceholders", () => {
  test("lists <..._SAID> placeholders still in the entries", () => {
    // setup: the page's default entries, and a filled-in copy
    const defaults = '[{"policy":"<MEMBER_POLICY_SAID>"},{"policy":"<REPO_LOCATION_POLICY_SAID>"}]'
    const filled = '[{"policy":"EAbc"},{"policy":"EDef"}]'
    // call our method under test
    const [left, none] = [unfilledPlaceholders(defaults), unfilledPlaceholders(filled)]
    // assertions: sign-in is refused on the page while any placeholder remains
    expect(left).toEqual(["<MEMBER_POLICY_SAID>", "<REPO_LOCATION_POLICY_SAID>"])
    expect(none).toEqual([])
  })
})
