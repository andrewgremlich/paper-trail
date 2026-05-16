import type { Env } from "./types";

const ENCRYPTED_PREFIX = "enc:";

// Per-isolate cache for the imported AES-GCM key. `importKey` is
// measurable on list endpoints that decrypt N rows; the imported
// CryptoKey is non-extractable so caching it is safe. Re-imports on
// key rotation (`material` mismatch).
let cachedKey: { material: string; key: CryptoKey } | null = null;

async function getKey(env: Env): Promise<CryptoKey> {
	if (cachedKey && cachedKey.material === env.ENCRYPTION_KEY) {
		return cachedKey.key;
	}
	const rawKey = Uint8Array.from(atob(env.ENCRYPTION_KEY), (c) =>
		c.charCodeAt(0),
	);
	const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
	cachedKey = { material: env.ENCRYPTION_KEY, key };
	return key;
}

export function isEncryptionEnabled(env: Env): boolean {
	return !!env.ENCRYPTION_KEY;
}

export async function encrypt(plaintext: string, env: Env): Promise<string> {
	if (!isEncryptionEnabled(env)) return plaintext;

	const key = await getKey(env);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);

	const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decrypt(value: string, env: Env): Promise<string> {
	if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
	if (!isEncryptionEnabled(env)) return value;

	const key = await getKey(env);
	const base64 = value.slice(ENCRYPTED_PREFIX.length);
	const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decrypted);
}

export async function encryptBuffer(
	data: ArrayBuffer,
	env: Env,
): Promise<ArrayBuffer> {
	if (!isEncryptionEnabled(env)) return data;

	const key = await getKey(env);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data,
	);

	const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return combined.buffer;
}

export async function decryptBuffer(
	data: ArrayBuffer,
	env: Env,
): Promise<ArrayBuffer> {
	if (!isEncryptionEnabled(env)) return data;

	const key = await getKey(env);
	const combined = new Uint8Array(data);
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

export function isEncrypted(value: string): boolean {
	return value.startsWith(ENCRYPTED_PREFIX);
}
