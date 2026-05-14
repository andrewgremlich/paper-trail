/**
 * Cloudflare Access JWT verification.
 *
 * Cloudflare Access issues an RS256-signed JWT in the
 * `Cf-Access-Jwt-Assertion` header on every authenticated request. The
 * shared secret is the team's JWKS, published at
 *   https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
 *
 * Without verifying the signature, the upstream `Cf-Access-Authenticated-User-Email`
 * header would be spoofable by anyone who can reach the Worker directly
 * (the workers.dev URL, internal LAN, etc.). Verifying the JWT is the
 * only thing that ties an inbound request to a Cloudflare-Access-vetted user.
 *
 * Implementation notes:
 * - We use the Web Crypto API (`RSASSA-PKCS1-v1_5` + SHA-256) so no extra
 *   dependencies are needed.
 * - JWKS responses are cached in a module-level Map for `JWKS_TTL_MS` so we
 *   don't refetch on every request. A cache miss / kid mismatch triggers a
 *   single refresh.
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

export type VerifiedAccessClaims = {
	email: string;
	sub: string;
	aud: string | string[];
	iss: string;
	exp: number;
	nbf?: number;
	iat?: number;
};

export class AccessJwtError extends Error {
	readonly reason:
		| "missing_token"
		| "malformed"
		| "unknown_kid"
		| "bad_signature"
		| "expired"
		| "not_yet_valid"
		| "bad_issuer"
		| "bad_audience"
		| "missing_email"
		| "config_missing"
		| "jwks_fetch_failed";

	constructor(reason: AccessJwtError["reason"], message?: string) {
		super(message ?? reason);
		this.name = "AccessJwtError";
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

const decodeJson = <T,>(input: string): T => {
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

const fetchJwks = async (teamDomain: string): Promise<JwksCacheEntry> => {
	const url = `https://${teamDomain}/cdn-cgi/access/certs`;
	const response = await fetch(url, {
		// Cloudflare Workers caches outbound fetches by default; this endpoint
		// is fine to cache for an hour.
		cf: { cacheTtl: 3600, cacheEverything: true },
		// biome-ignore lint/suspicious/noExplicitAny: cf field is Workers-specific
	} as any);
	if (!response.ok) {
		throw new AccessJwtError(
			"jwks_fetch_failed",
			`JWKS fetch returned ${response.status}`,
		);
	}
	const body = (await response.json()) as { keys?: Jwk[] };
	if (!body.keys || body.keys.length === 0) {
		throw new AccessJwtError("jwks_fetch_failed", "JWKS response has no keys");
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

const getKey = async (
	teamDomain: string,
	kid: string,
): Promise<CryptoKey | null> => {
	const cached = jwksCache.get(teamDomain);
	const fresh = cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS;
	if (cached && fresh) {
		const key = cached.keys.get(kid);
		if (key) return key;
		// Fall through and try refreshing — key rotation may have happened.
	}
	const refreshed = await fetchJwks(teamDomain);
	jwksCache.set(teamDomain, refreshed);
	return refreshed.keys.get(kid) ?? null;
};

const audMatches = (
	claim: string | string[] | undefined,
	expected: string,
): boolean => {
	if (typeof claim === "string") return claim === expected;
	if (Array.isArray(claim)) return claim.includes(expected);
	return false;
};

/**
 * Verifies a Cloudflare Access JWT and returns its claims. Throws
 * `AccessJwtError` on any failure — callers should map that to a 401.
 *
 * `teamDomain` is the bare host (e.g. `acme.cloudflareaccess.com`) and
 * `aud` is the Application Audience Tag from the Cloudflare Access app.
 */
export const verifyAccessJwt = async (
	token: string,
	teamDomain: string,
	aud: string,
): Promise<VerifiedAccessClaims> => {
	if (!token) throw new AccessJwtError("missing_token");
	const parts = token.split(".");
	if (parts.length !== 3) throw new AccessJwtError("malformed");

	const [headerB64, payloadB64, signatureB64] = parts;

	let header: { alg?: string; kid?: string };
	let payload: VerifiedAccessClaims;
	try {
		header = decodeJson<{ alg?: string; kid?: string }>(headerB64);
		payload = decodeJson<VerifiedAccessClaims>(payloadB64);
	} catch {
		throw new AccessJwtError("malformed");
	}

	if (header.alg !== "RS256" || !header.kid) {
		throw new AccessJwtError("malformed");
	}

	const key = await getKey(teamDomain, header.kid);
	if (!key) throw new AccessJwtError("unknown_kid");

	const signature = base64UrlDecode(signatureB64);
	const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
	const valid = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		signature,
		signedData,
	);
	if (!valid) throw new AccessJwtError("bad_signature");

	const nowSec = Math.floor(Date.now() / 1000);
	if (typeof payload.exp !== "number" || payload.exp < nowSec) {
		throw new AccessJwtError("expired");
	}
	if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) {
		throw new AccessJwtError("not_yet_valid");
	}

	const expectedIssuer = `https://${teamDomain}`;
	if (payload.iss !== expectedIssuer) {
		throw new AccessJwtError("bad_issuer");
	}
	if (!audMatches(payload.aud, aud)) {
		throw new AccessJwtError("bad_audience");
	}
	if (!payload.email || typeof payload.email !== "string") {
		throw new AccessJwtError("missing_email");
	}

	return payload;
};

/**
 * Returns the configured team domain + audience, or null if Access
 * verification is disabled. Throws `AccessJwtError("config_missing")` if
 * configuration is partial — that's almost certainly a deployment bug and
 * we should fail closed rather than silently fall back to header-trust.
 */
export const getAccessConfig = (
	env: Env,
): { teamDomain: string; aud: string } | null => {
	const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
	const aud = env.CF_ACCESS_AUD;
	if (!teamDomain && !aud) return null;
	if (!teamDomain || !aud) {
		throw new AccessJwtError(
			"config_missing",
			"Partial Access config: set both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD",
		);
	}
	// Defend against accidental scheme leak in env var.
	const clean = teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
	return { teamDomain: clean, aud };
};

// Exported for tests
export const __resetJwksCacheForTests = (): void => {
	jwksCache.clear();
};
