import { describe, expect, it } from "vitest";
import {
	decrypt,
	decryptBuffer,
	encrypt,
	encryptBuffer,
	isEncrypted,
	isEncryptionEnabled,
} from "./crypto";
import type { Env } from "./types";

const makeKey = (): string => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

const envWithKey = (key: string = makeKey()): Env =>
	({ ENCRYPTION_KEY: key }) as Env;

const envWithoutKey = (): Env => ({ ENCRYPTION_KEY: "" }) as Env;

describe("isEncryptionEnabled", () => {
	it("returns true when ENCRYPTION_KEY is set", () => {
		expect(isEncryptionEnabled(envWithKey())).toBe(true);
	});

	it("returns false when ENCRYPTION_KEY is empty", () => {
		expect(isEncryptionEnabled(envWithoutKey())).toBe(false);
	});
});

describe("isEncrypted", () => {
	it("detects the enc: prefix", () => {
		expect(isEncrypted("enc:abc")).toBe(true);
	});

	it("returns false for plaintext", () => {
		expect(isEncrypted("hello")).toBe(false);
		expect(isEncrypted("")).toBe(false);
	});
});

describe("encrypt / decrypt round-trip", () => {
	it("encrypts then decrypts to original plaintext", async () => {
		const env = envWithKey();
		const plaintext = "hello world";
		const ct = await encrypt(plaintext, env);
		expect(ct).not.toBe(plaintext);
		expect(ct.startsWith("enc:")).toBe(true);
		const pt = await decrypt(ct, env);
		expect(pt).toBe(plaintext);
	});

	it("uses a random IV (same plaintext yields different ciphertext)", async () => {
		const env = envWithKey();
		const a = await encrypt("repeat me", env);
		const b = await encrypt("repeat me", env);
		expect(a).not.toBe(b);
		expect(await decrypt(a, env)).toBe("repeat me");
		expect(await decrypt(b, env)).toBe("repeat me");
	});

	it("handles unicode / emoji", async () => {
		const env = envWithKey();
		const plaintext = "résumé 🎉 — naïve";
		const ct = await encrypt(plaintext, env);
		expect(await decrypt(ct, env)).toBe(plaintext);
	});

	it("returns plaintext as-is when encryption is disabled", async () => {
		const env = envWithoutKey();
		const out = await encrypt("hello", env);
		expect(out).toBe("hello");
	});

	it("decrypt passes through values missing the enc: prefix", async () => {
		const env = envWithKey();
		expect(await decrypt("plain string", env)).toBe("plain string");
	});

	it("decrypt passes through enc:-prefixed value when encryption disabled", async () => {
		// If the key is missing we cannot decrypt — the function returns the
		// raw value rather than throwing, by design (graceful for unencrypted DBs).
		const env = envWithoutKey();
		expect(await decrypt("enc:xyz", env)).toBe("enc:xyz");
	});
});

describe("encryptBuffer / decryptBuffer round-trip", () => {
	it("round-trips arbitrary bytes", async () => {
		const env = envWithKey();
		const data = new Uint8Array([0, 1, 2, 3, 255, 128, 64]).buffer;
		const ct = await encryptBuffer(data, env);
		expect(ct.byteLength).toBeGreaterThan(data.byteLength); // includes IV + tag
		const pt = await decryptBuffer(ct, env);
		expect(new Uint8Array(pt)).toEqual(new Uint8Array(data));
	});

	it("returns input unchanged when encryption is disabled", async () => {
		const env = envWithoutKey();
		const data = new Uint8Array([1, 2, 3]).buffer;
		const out = await encryptBuffer(data, env);
		expect(out).toBe(data);
	});
});

describe("decrypt with wrong key", () => {
	it("throws when ciphertext was encrypted under a different key", async () => {
		const envA = envWithKey();
		const envB = envWithKey();
		const ct = await encrypt("secret", envA);
		await expect(decrypt(ct, envB)).rejects.toBeDefined();
	});
});
