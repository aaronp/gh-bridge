const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** RFC 7636 code verifier: 32 random bytes → 43 base64url chars. */
export const randomVerifier = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** S256 challenge: base64url(SHA-256(verifier)), unpadded. */
export const challengeFor = async (verifier: string): Promise<string> =>
  b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
