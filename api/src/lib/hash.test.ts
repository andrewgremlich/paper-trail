import { describe, expect, it } from "vitest";
import {
	constantTimeEqual,
	hmacSha256Hex,
	randomHexToken,
	sha256Hex,
} from "./hash";
import type { Env } from "./types";

const makeKey = (): string => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

const envWithKey = (key: string = makeKey()): Env =>
	({ ENCRYPTION_KEY: key }) as Env;

describe("hmacSha256Hex", () => {
	it("returns a 64-character lowercase hex string", async () => {
		const out = await hmacSha256Hex("hello", envWithKey());
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same key + input", async () => {
		const env = envWithKey();
		const a = await hmacSha256Hex("user@example.com", env);
		const b = await hmacSha256Hex("user@example.com", env);
		expect(a).toBe(b);
	});

	it("produces different output for different inputs (same key)", async () => {
		const env = envWithKey();
		const a = await hmacSha256Hex("a@example.com", env);
		const b = await hmacSha256Hex("b@example.com", env);
		expect(a).not.toBe(b);
	});

	it("produces different output for different keys (same input)", async () => {
		const a = await hmacSha256Hex("same", envWithKey());
		const b = await hmacSha256Hex("same", envWithKey());
		expect(a).not.toBe(b);
	});

});

describe("sha256Hex (legacy)", () => {
	it("returns a 64-character lowercase hex string", async () => {
		const out = await sha256Hex("hello", envWithKey());
		expect(out).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same salt + input", async () => {
		const env = envWithKey();
		expect(await sha256Hex("x", env)).toBe(await sha256Hex("x", env));
	});

	it("matches the documented H(salt || input) construction", async () => {
		const env = { ENCRYPTION_KEY: "salt" } as Env;
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
