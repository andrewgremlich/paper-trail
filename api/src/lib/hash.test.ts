import { describe, expect, it } from "vitest";
import {
	constantTimeEqual,
	hmacSha256Hex,
	randomHexToken,
	sha256Hex,
} from "./hash";
import type { Env } from "./types";

const makeHmacKey = async (): Promise<CryptoKey> => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return crypto.subtle.importKey(
		"raw",
		bytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
};

describe("hmacSha256Hex", () => {
	it("returns a 64-character lowercase hex string", async () => {
		const key = await makeHmacKey();
		const out = await hmacSha256Hex("hello", key);
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same key + input", async () => {
		const key = await makeHmacKey();
		const a = await hmacSha256Hex("user@example.com", key);
		const b = await hmacSha256Hex("user@example.com", key);
		expect(a).toBe(b);
	});

	it("produces different output for different inputs (same key)", async () => {
		const key = await makeHmacKey();
		const a = await hmacSha256Hex("a@example.com", key);
		const b = await hmacSha256Hex("b@example.com", key);
		expect(a).not.toBe(b);
	});

	it("produces different output for different keys (same input)", async () => {
		const keyA = await makeHmacKey();
		const keyB = await makeHmacKey();
		const a = await hmacSha256Hex("same", keyA);
		const b = await hmacSha256Hex("same", keyB);
		expect(a).not.toBe(b);
	});
});

describe("sha256Hex (legacy)", () => {
	const envWithSalt = (salt: string): Env => ({ ENCRYPTION_KEY: salt }) as Env;

	it("returns a 64-character lowercase hex string", async () => {
		const out = await sha256Hex("hello", envWithSalt("salt"));
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same salt + input", async () => {
		const env = envWithSalt("salt");
		expect(await sha256Hex("x", env)).toBe(await sha256Hex("x", env));
	});

	it("matches the documented H(salt || input) construction", async () => {
		const env = envWithSalt("salt");
		const out = await sha256Hex("msg", env);

		// Reference: SHA-256 of "salt" + "msg" = "saltmsg"
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode("saltmsg"),
		);
		const expected = Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(out).toBe(expected);
	});
});

describe("randomHexToken", () => {
	it("defaults to 32 bytes / 64 hex chars", () => {
		const t = randomHexToken();
		expect(t).toMatch(/^[0-9a-f]{64}$/);
	});

	it("respects a custom byte length", () => {
		expect(randomHexToken(8)).toMatch(/^[0-9a-f]{16}$/);
		expect(randomHexToken(1)).toMatch(/^[0-9a-f]{2}$/);
	});

	it("returns a different value each call (overwhelmingly likely)", () => {
		const a = randomHexToken();
		const b = randomHexToken();
		expect(a).not.toBe(b);
	});
});

describe("constantTimeEqual", () => {
	it("returns true for identical strings", () => {
		expect(constantTimeEqual("abc", "abc")).toBe(true);
		expect(constantTimeEqual("", "")).toBe(true);
	});

	it("returns false when strings differ", () => {
		expect(constantTimeEqual("abc", "abd")).toBe(false);
	});

	it("returns false when lengths differ even if one is a prefix", () => {
		expect(constantTimeEqual("abc", "abcd")).toBe(false);
		expect(constantTimeEqual("abcd", "abc")).toBe(false);
		expect(constantTimeEqual("", "x")).toBe(false);
	});

	it("handles unicode (multi-byte) correctly", () => {
		expect(constantTimeEqual("résumé", "résumé")).toBe(true);
		expect(constantTimeEqual("résumé", "resume")).toBe(false);
	});
});
