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

const makeKey = async (): Promise<CryptoKey> => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
};

const envWithKey = (): Env =>
	({
		ENCRYPTION_KEY: btoa(
			String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
		),
	}) as Env;

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
		const key = await makeKey();
		const plaintext = "hello world";
		const ct = await encrypt(plaintext, key);
		expect(ct).not.toBe(plaintext);
		expect(ct.startsWith("enc:")).toBe(true);
		const pt = await decrypt(ct, key);
		expect(pt).toBe(plaintext);
	});

	it("uses a random IV (same plaintext yields different ciphertext)", async () => {
		const key = await makeKey();
		const a = await encrypt("repeat me", key);
		const b = await encrypt("repeat me", key);
		expect(a).not.toBe(b);
		expect(await decrypt(a, key)).toBe("repeat me");
		expect(await decrypt(b, key)).toBe("repeat me");
	});

	it("handles unicode / emoji", async () => {
		const key = await makeKey();
		const plaintext = "résumé 🎉 — naïve";
		const ct = await encrypt(plaintext, key);
		expect(await decrypt(ct, key)).toBe(plaintext);
	});

	it("decrypt passes through values missing the enc: prefix", async () => {
		const key = await makeKey();
		expect(await decrypt("plain string", key)).toBe("plain string");
	});
});

describe("encryptBuffer / decryptBuffer round-trip", () => {
	it("round-trips arbitrary bytes", async () => {
		const key = await makeKey();
		const data = new Uint8Array([0, 1, 2, 3, 255, 128, 64]).buffer;
		const ct = await encryptBuffer(data, key);
		expect(ct.byteLength).toBeGreaterThan(data.byteLength); // includes IV + tag
		const pt = await decryptBuffer(ct, key);
		expect(new Uint8Array(pt)).toEqual(new Uint8Array(data));
	});
});

describe("decrypt with wrong key", () => {
	it("throws when ciphertext was encrypted under a different key", async () => {
		const keyA = await makeKey();
		const keyB = await makeKey();
		const ct = await encrypt("secret", keyA);
		await expect(decrypt(ct, keyB)).rejects.toBeDefined();
	});
});
