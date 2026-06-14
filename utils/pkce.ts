// PKCE helpers (RFC 7636) built on the Web Crypto API. No dependencies.

/** Base64url-encode raw bytes (no padding), as required for PKCE. */
function base64url(bytes: ArrayBuffer): string {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A high-entropy code verifier (43–128 chars from the unreserved set). */
export function generateCodeVerifier(): string {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64url(arr.buffer);
}

/** S256 challenge = base64url(SHA-256(verifier)). */
export async function codeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

/** Opaque anti-CSRF state value. */
export function randomState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return base64url(arr.buffer);
}
