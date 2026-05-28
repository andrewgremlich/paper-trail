import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	__resetClerkJwksCacheForTests,
	ClerkJwtError,
	getClerkConfig,
	verifyClerkJwt,
} from "./clerkJwt";
import type { Env } from "./types";

// --- key + JWT helpers -------------------------------------------------

type RsaPair = {
	publicKey: CryptoKey;
	privateKey: CryptoKey;
	jwkPublic: JsonWebKey & { kid: string };
	pemPublic: string;
};

const b64urlEncode = (bytes: Uint8Array): string => {
	let bin = "";
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
};

const b64urlString = (value: string): string =>
	b64urlEncode(new TextEncoder().encode(value));

const generateRsa = async (kid = "test-kid-1"): Promise<RsaPair> => {
	const pair = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);
	const { publicKey, privateKey } = pair as CryptoKeyPair;
	const jwk = (await crypto.subtle.exportKey("jwk", publicKey)) as JsonWebKey;
	const jwkPublic = { ...jwk, kid, alg: "RS256", use: "sig" } as JsonWebKey & {
		kid: string;
	};
	const spki = (await crypto.subtle.exportKey(
		"spki",
		publicKey,
	)) as ArrayBuffer;
	const pemBody = (
		btoa(String.fromCharCode(...new Uint8Array(spki))).match(/.{1,64}/g) ?? []
	).join("\n");
	const pemPublic = `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----\n`;
	return { publicKey, privateKey, jwkPublic, pemPublic };
};

type Header = { alg: string; kid?: string; typ?: string };
type Claims = Record<string, unknown>;

const signJwt = async (
	header: Header,
	claims: Claims,
	privateKey: CryptoKey,
): Promise<string> => {
	const h = b64urlString(JSON.stringify(header));
	const p = b64urlString(JSON.stringify(claims));
	const data = new TextEncoder().encode(`${h}.${p}`);
	const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
	return `${h}.${p}.${b64urlEncode(new Uint8Array(sig))}`;
};

const nowSec = () => Math.floor(Date.now() / 1000);

const baseClaims = (overrides: Claims = {}): Claims => ({
	sub: "user_test_123",
	iss: "https://clerk.example.com",
	exp: nowSec() + 60,
	nbf: nowSec() - 5,
	iat: nowSec() - 5,
	...overrides,
});

// --- tests -------------------------------------------------------------

describe("verifyClerkJwt — PEM (networkless) mode", () => {
	let pair: RsaPair;

	beforeEach(async () => {
		__resetClerkJwksCacheForTests();
		pair = await generateRsa();
	});

	const verify = (
		token: string,
		extra: Partial<Parameters<typeof verifyClerkJwt>[1]> = {},
	) =>
		verifyClerkJwt(token, {
			issuer: "https://clerk.example.com",
			jwtKey: pair.pemPublic,
			...extra,
		});

	it("verifies a well-formed token and returns the claims", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "ignored-in-pem-mode" },
			baseClaims(),
			pair.privateKey,
		);
		const claims = await verify(token);
		expect(claims.sub).toBe("user_test_123");
		expect(claims.iss).toBe("https://clerk.example.com");
	});

	it("rejects missing token", async () => {
		await expect(verify("")).rejects.toMatchObject({
			name: "ClerkJwtError",
			reason: "missing_token",
		});
	});

	it("rejects token without three parts", async () => {
		await expect(verify("not.a.jwt.token")).rejects.toMatchObject({
			reason: "malformed",
		});
		await expect(verify("only.two")).rejects.toMatchObject({
			reason: "malformed",
		});
	});

	it("rejects header that isn't valid base64url JSON", async () => {
		await expect(verify("!!!.eyJzdWIiOiJ4In0.xxx")).rejects.toMatchObject({
			reason: "malformed",
		});
	});

	it("rejects alg != RS256 (alg pinning — defends against alg=none / HS256 confusion)", async () => {
		const token = await signJwt(
			{ alg: "HS256", typ: "JWT" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "malformed",
		});

		const none = await signJwt(
			{ alg: "none", typ: "JWT" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(verify(none)).rejects.toMatchObject({
			reason: "malformed",
		});
	});

	it("rejects typ != JWT when typ is present", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "not-jwt" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "malformed",
		});
	});

	it("accepts a token without a typ header (typ pin only applies when present)", async () => {
		const token = await signJwt(
			{ alg: "RS256" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(verify(token)).resolves.toMatchObject({
			sub: "user_test_123",
		});
	});

	it("rejects when signature was made with a different key", async () => {
		const other = await generateRsa("other-kid");
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims(),
			other.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "bad_signature",
		});
	});

	it("rejects expired tokens (beyond the 60s skew)", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ exp: nowSec() - 120 }), // expired 2 min ago
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "expired",
		});
	});

	it("accepts a token that expired within the 60s skew window", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ exp: nowSec() - 30 }), // expired 30s ago — inside skew
			pair.privateKey,
		);
		await expect(verify(token)).resolves.toBeDefined();
	});

	it("rejects token missing exp claim", async () => {
		const claims = baseClaims();
		delete (claims as { exp?: number }).exp;
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			claims,
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "expired",
		});
	});

	it("rejects nbf in the future (beyond the 60s skew)", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ nbf: nowSec() + 300 }),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "not_yet_valid",
		});
	});

	it("rejects iat far in the future", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ iat: nowSec() + 600 }),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "malformed",
		});
	});

	it("rejects when issuer does not match config", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ iss: "https://attacker.example.com" }),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "bad_issuer",
		});
	});

	it("normalizes trailing slash on configured issuer", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(token, {
				issuer: "https://clerk.example.com/",
				jwtKey: pair.pemPublic,
			}),
		).resolves.toBeDefined();
	});

	it("enforces authorizedParty when configured", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ azp: "https://app.example.com" }),
			pair.privateKey,
		);
		// matching azp → ok
		await expect(
			verify(token, { authorizedParty: "https://app.example.com" }),
		).resolves.toBeDefined();
		// wrong azp → rejected
		await expect(
			verify(token, { authorizedParty: "https://other.example.com" }),
		).rejects.toMatchObject({ reason: "bad_azp" });
	});

	it("rejects when authorizedParty is set but token has no azp", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verify(token, { authorizedParty: "https://app.example.com" }),
		).rejects.toMatchObject({ reason: "bad_azp" });
	});

	it("rejects token missing sub", async () => {
		const claims = baseClaims();
		delete (claims as { sub?: string }).sub;
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			claims,
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "missing_sub",
		});
	});

	it("rejects sub that is not a string", async () => {
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" },
			baseClaims({ sub: 12345 }),
			pair.privateKey,
		);
		await expect(verify(token)).rejects.toMatchObject({
			reason: "missing_sub",
		});
	});
});

describe("verifyClerkJwt — JWKS mode", () => {
	const origFetch = globalThis.fetch;
	let pair: RsaPair;

	beforeEach(async () => {
		__resetClerkJwksCacheForTests();
		pair = await generateRsa("kid-a");
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = origFetch;
		vi.restoreAllMocks();
	});

	const mountJwks = (jwks: { keys: unknown[] }) => {
		globalThis.fetch = vi.fn(
			async () =>
				new Response(JSON.stringify(jwks), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		) as unknown as typeof fetch;
	};

	it("verifies via JWKS and caches the response", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ keys: [pair.jwkPublic] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const token = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-a" },
			baseClaims(),
			pair.privateKey,
		);
		const config = { issuer: "https://clerk.example.com" };
		await expect(verifyClerkJwt(token, config)).resolves.toBeDefined();
		await expect(verifyClerkJwt(token, config)).resolves.toBeDefined();
		// Second call should hit the cache → fetch called exactly once.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("refreshes the JWKS on kid mismatch (covers Clerk key rotation)", async () => {
		// Prime the cache with an OLD key (kid-old), then ask for kid-a — the
		// verifier should refresh because the cached entry is missing kid-a.
		const other = await generateRsa("kid-old");
		let callCount = 0;
		globalThis.fetch = vi.fn(async () => {
			callCount++;
			const keys = callCount === 1 ? [other.jwkPublic] : [pair.jwkPublic];
			return new Response(JSON.stringify({ keys }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}) as unknown as typeof fetch;

		// Call 1: prime cache with kid-old
		const oldToken = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-old" },
			baseClaims(),
			other.privateKey,
		);
		await verifyClerkJwt(oldToken, { issuer: "https://clerk.example.com" });

		// Call 2: ask for kid-a — cache fresh but missing kid-a → refresh
		const newToken = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-a" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(newToken, { issuer: "https://clerk.example.com" }),
		).resolves.toBeDefined();
		expect(callCount).toBe(2);
	});

	it("throws unknown_kid when the refreshed JWKS still doesn't have the kid", async () => {
		const other = await generateRsa("kid-other");
		mountJwks({ keys: [other.jwkPublic] });

		const token = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-a" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(token, { issuer: "https://clerk.example.com" }),
		).rejects.toMatchObject({ reason: "unknown_kid" });
	});

	it("throws jwks_fetch_failed when the upstream returns non-200", async () => {
		globalThis.fetch = vi.fn(
			async () => new Response("fail", { status: 503 }),
		) as unknown as typeof fetch;

		const token = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-a" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(token, { issuer: "https://clerk.example.com" }),
		).rejects.toMatchObject({ reason: "jwks_fetch_failed" });
	});

	it("throws jwks_fetch_failed when JWKS response is empty", async () => {
		mountJwks({ keys: [] });
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT", kid: "kid-a" },
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(token, { issuer: "https://clerk.example.com" }),
		).rejects.toMatchObject({ reason: "jwks_fetch_failed" });
	});

	it("rejects token without a kid header in JWKS mode", async () => {
		mountJwks({ keys: [pair.jwkPublic] });
		const token = await signJwt(
			{ alg: "RS256", typ: "JWT" }, // no kid
			baseClaims(),
			pair.privateKey,
		);
		await expect(
			verifyClerkJwt(token, { issuer: "https://clerk.example.com" }),
		).rejects.toMatchObject({ reason: "malformed" });
	});
});

describe("getClerkConfig", () => {
	const env = (overrides: Partial<Env> = {}): Env =>
		({ ENCRYPTION_KEY: "x", ...overrides }) as Env;

	it("returns null when CLERK_ISSUER is unset (Clerk disabled)", () => {
		expect(getClerkConfig(env())).toBeNull();
	});

	it("returns null when CLERK_ISSUER is empty string / whitespace", () => {
		expect(getClerkConfig(env({ CLERK_ISSUER: "   " }))).toBeNull();
	});

	it("trims trailing slash on the issuer", () => {
		const cfg = getClerkConfig(
			env({ CLERK_ISSUER: "https://clerk.example.com/" }),
		);
		expect(cfg?.issuer).toBe("https://clerk.example.com");
	});

	it("throws config_missing when issuer is not https://", () => {
		expect(() =>
			getClerkConfig(env({ CLERK_ISSUER: "http://clerk.example.com" })),
		).toThrow(ClerkJwtError);
	});

	it("forwards CLERK_AUTHORIZED_PARTY and CLERK_JWT_KEY", () => {
		const cfg = getClerkConfig(
			env({
				CLERK_ISSUER: "https://clerk.example.com",
				CLERK_AUTHORIZED_PARTY: "https://app.example.com",
				CLERK_JWT_KEY:
					"-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----",
			}),
		);
		expect(cfg?.authorizedParty).toBe("https://app.example.com");
		expect(cfg?.jwtKey).toContain("BEGIN PUBLIC KEY");
	});

	it("treats whitespace-only optional fields as unset", () => {
		const cfg = getClerkConfig(
			env({
				CLERK_ISSUER: "https://clerk.example.com",
				CLERK_AUTHORIZED_PARTY: "   ",
				CLERK_JWT_KEY: "",
			}),
		);
		expect(cfg?.authorizedParty).toBeUndefined();
		expect(cfg?.jwtKey).toBeUndefined();
	});
});
