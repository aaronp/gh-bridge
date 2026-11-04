import { describe, expect, test } from "bun:test"
import { challengeFor, randomVerifier } from "./pkce"

describe("pkce", () => {
  test("challenge matches RFC 7636 appendix B", async () => {
    // setup: the RFC's example verifier
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // call our method under test
    const challenge = await challengeFor(verifier)
    // assertions: S256 challenge is the RFC's value, unpadded base64url
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
  })

  test("random verifiers are valid and distinct", () => {
    // setup: none, verifiers come from WebCrypto
    // call our method under test
    const [a, b] = [randomVerifier(), randomVerifier()]
    // assertions: RFC 7636 charset and length, and not repeated
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(a).not.toBe(b)
  })
})
