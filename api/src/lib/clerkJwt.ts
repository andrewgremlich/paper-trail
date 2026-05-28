/**
 * Clerk session JWT verification.
 *
 * Clerk issues an RS256-signed session JWT to authenticated clients. The
 * frontend (`@clerk/react`) attaches it via
 * `Authorization: Bearer <token>` on every API request. We verify the
 * signature against Clerk's JWKS before trusting the `sub` claim that
 * identifies the user.
 *
 * Without verifying the signature, anyone who can reach the Worker URL
 * could forge a token and impersonate a user. Verifying the JWT is the
 * only thing that ties an inbound request to a Clerk-vetted user.
 *
 * Implementation mirrors the previous Cloudflare Access verifier:
 * - Web Crypto API (RSASSA-PKCS1-v1_5 + SHA-256). No extra deps.
 * - JWKS responses cached in a module-level Map for `JWKS_TTL_MS` so we
 *   don't refetch on every request. A cache miss / kid mismatch triggers a
 *   single refresh (covers Clerk key rotation).
 *
 * Networkless mode: if `CLERK_JWT_KEY` (Clerk's "JWKS public key" PEM from
 * the dashboard) is configured, we skip the JWKS fetch entirely and verify
 * against that key. This is the recommended production setup because it
 * avoids an outbound fetch on cold paths and works inside Cloudflare's
 * cache-deny network conditions.
 */
import type { Env } from "./types";

const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

type Jwk = {
	kid: string;
	kty: "RSA";
	alg?: string;
	n: string;
	e: string;
	use?: string;
};

type JwksCacheEntry = {
	fetchedAt: number;
	keys: Map<string, CryptoKey>;
};

const jwksCache = new Map<string, JwksCacheEntry>();
// Networkless verification keys cached by PEM string so we only import
// once per cold start.
const pemKeyCache = new Map<string, CryptoKey>();

/**
 * Subset of the Clerk session JWT claims we care about. Clerk includes
 * many more (azp, sid, etc.) but they're not used for authorization here.
 *
 * `sub` is the stable Clerk user ID (e.g. `user_2abcDEF...`). It is the
 * source of truth for identity. Email is NOT included in default session
 * tokens — fetch it separately via the Backend API when provisioning a
 * new local user row.
 */
export type VerifiedClerkClaims = {
	sub: string;
	iss: string;
	exp: number;
	nbf?: number;
	iat?: number;
	azp?: string;
};

export class ClerkJwtError extends Error {
	readonly reason:
		| "missing_token"
		| "malformed"
		| "unknown_kid"
		| "bad_signature"
		| "expired"
		| "not_yet_valid"
		| "bad_issuer"
		| "bad_azp"
		| "missing_sub"
		| "config_missing"
		| "jwks_fetch_failed";

	constructor(reason: ClerkJwtError["reason"], message?: string) {
		super(message ?? reason);
		this.name = "ClerkJwtError";
		this.reason = reason;
	}
}

const base64UrlDecode = (input: string): Uint8Array => {
	const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
	const b64 = input.replaceAll("-", "+").replaceAll("_", "/") + pad;
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};

const decodeJson = <T>(input: string): T => {
	const decoded = new TextDecoder().decode(base64UrlDecode(input));
	return JSON.parse(decoded) as T;
};

const importJwk = async (jwk: Jwk): Promise<CryptoKey> =>
	crypto.subtle.importKey(
		"jwk",
		{
			kty: jwk.kty,
			n: jwk.n,
			e: jwk.e,
			alg: "RS256",
			ext: true,
		},
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);

const fetchJwks = async (issuer: string): Promise<JwksCacheEntry> => {
	const url = `${issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
	const response = await fetch(url, {
		cf: { cacheTtl: 3600, cacheEverything: true },
		// biome-ignore lint/suspicious/noExplicitAny: cf field is Workers-specific
	} as any);
	if (!response.ok) {
		throw new ClerkJwtError(
			"jwks_fetch_failed",
			`JWKS fetch returned ${response.status}`,
		);
	}
	const body = (await response.json()) as { keys?: Jwk[] };
	if (!body.keys || body.keys.length === 0) {
		throw new ClerkJwtError("jwks_fetch_failed", "JWKS response has no keys");
	}
	const keys = new Map<string, CryptoKey>();
	for (const jwk of body.keys) {
		if (jwk.kty !== "RSA") continue;
		try {
			keys.set(jwk.kid, await importJwk(jwk));
		} catch {
			// Skip malformed JWKs rather than fail the whole load.
		}
	}
	return { fetchedAt: Date.now(), keys };
};

const getKeyFromJwks = async (
	issuer: string,
	kid: string,
): Promise<CryptoKey | null> => {
	const cached = jwksCache.get(issuer);
	const fresh = cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS;
	if (cached && fresh) {
		const key = cached.keys.get(kid);
		if (key) return key;
		// Fall through and refresh — Clerk rotated.
	}
	const refreshed = await fetchJwks(issuer);
	jwksCache.set(issuer, refreshed);
	return refreshed.keys.get(kid) ?? null;
};

const pemToCryptoKey = async (pem: string): Promise<CryptoKey> => {
	const cached = pemKeyCache.get(pem);
	if (cached) return cached;
	const body = pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, "")
		.replace(/-----END PUBLIC KEY-----/g, "")
		.replace(/\s+/g, "");
	const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
	const key = await crypto.subtle.importKey(
		"spki",
		der,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	pemKeyCache.set(pem, key);
	return key;
};

/**
 * Verifies a Clerk session JWT and returns its claims. Throws
 * `ClerkJwtError` on any failure — callers should map that to a 401.
 *
 * `config.issuer` is the Clerk Frontend API URL (e.g.
 * `https://clerk.example.com` or `https://verb-noun-00.clerk.accounts.dev`).
 *
 * `config.authorizedParty` is optional; when set the `azp` claim must
 * match. Use it to lock tokens to a specific frontend origin (defence in
 * depth against tokens leaked from another Clerk-protected app under the
 * same instance).
 *
 * `config.jwtKey` is optional; when set (PEM), networkless verification
 * is used instead of fetching the JWKS.
 */
export const verifyClerkJwt = async (
	token: string,
	config: { issuer: string; authorizedParty?: string; jwtKey?: string },
): Promise<VerifiedClerkClaims> => {
	if (!token) throw new ClerkJwtError("missing_token");
	const parts = token.split(".");
	if (parts.length !== 3) throw new ClerkJwtError("malformed");

	const [headerB64, payloadB64, signatureB64] = parts;

	let header: { alg?: string; kid?: string; typ?: string };
	let payload: VerifiedClerkClaims;
	try {
		header = decodeJson<{ alg?: string; kid?: string; typ?: string }>(
			headerB64,
		);
		payload = decodeJson<VerifiedClerkClaims>(payloadB64);
	} catch {
		throw new ClerkJwtError("malformed");
	}

	if (header.alg !== "RS256") {
		throw new ClerkJwtError("malformed");
	}
	// Pin `typ` when present. Clerk emits `typ=JWT`; rejecting other
	// values defends against token-confusion across Clerk product surfaces.
	if (header.typ && header.typ !== "JWT") {
		throw new ClerkJwtError("malformed");
	}

	let key: CryptoKey | null = null;
	if (config.jwtKey) {
		key = await pemToCryptoKey(config.jwtKey);
	} else {
		if (!header.kid) throw new ClerkJwtError("malformed");
		key = await getKeyFromJwks(config.issuer, header.kid);
		if (!key) throw new ClerkJwtError("unknown_kid");
	}

	const signature = base64UrlDecode(signatureB64);
	const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const valid = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		signature,
		signedData,
	);
	if (!valid) throw new ClerkJwtError("bad_signature");

	const nowSec = Math.floor(Date.now() / 1000);
	// Allow 60 s of clock skew on `exp` so a slow Worker clock doesn't
	// reject freshly-issued tokens that just crossed the expiry boundary.
	// Matches the existing 60 s tolerance on `nbf`.
	if (typeof payload.exp !== "number" || payload.exp + 60 < nowSec) {
		throw new ClerkJwtError("expired");
	}
	if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) {
		throw new ClerkJwtError("not_yet_valid");
	}
	// `iat` in the far future means a forged or badly-clock-skewed token.
	if (typeof payload.iat === "number" && payload.iat > nowSec + 60) {
		throw new ClerkJwtError("malformed");
	}

	const expectedIssuer = config.issuer.replace(/\/$/, "");
	if (payload.iss !== expectedIssuer) {
		throw new ClerkJwtError("bad_issuer");
	}

	if (config.authorizedParty && payload.azp !== config.authorizedParty) {
		throw new ClerkJwtError("bad_azp");
	}

	if (!payload.sub || typeof payload.sub !== "string") {
		throw new ClerkJwtError("missing_sub");
	}

	return payload;
};

/**
 * Returns the configured Clerk verification parameters, or null if Clerk
 * verification is disabled (no issuer). Throws
 * `ClerkJwtError("config_missing")` only when partially configured.
 */
export const getClerkConfig = (
	env: Env,
): {
	issuer: string;
	authorizedParty?: string;
	jwtKey?: string;
} | null => {
	const issuer = env.CLERK_ISSUER?.trim();
	if (!issuer) return null;

	const clean = issuer.replace(/\/$/, "");
	// Clerk issuers always start with https://
	if (!/^https:\/\//.test(clean)) {
		throw new ClerkJwtError(
			"config_missing",
			"CLERK_ISSUER must be an https:// URL",
		);
	}
	return {
		issuer: clean,
		authorizedParty: env.CLERK_AUTHORIZED_PARTY?.trim() || undefined,
		jwtKey: env.CLERK_JWT_KEY?.trim() || undefined,
	};
};

// Exported for tests
export const __resetClerkJwksCacheForTests = (): void => {
	jwksCache.clear();
	pemKeyCache.clear();
};
