import { getDb } from "./db";
import type { Env } from "./types";

const ENCRYPTED_PREFIX = "enc:";

// Versioned Key Encryption Keys (KEKs). KEKs wrap per-user Data
// Encryption Keys (DEKs) and never touch row ciphertext directly. The
// legacy `ENCRYPTION_KEY` env binding is an alias for `KEK_V1` so
// existing deployments keep working without a secret rename.
//
// Lookup is `env.KEK_V<n>` starting at n=1, walking upward until the
// first gap. The highest-numbered present version is the *active*
// KEK used for wrapping new DEKs; lower versions are kept available
// for unwrapping older `wrappedDek` values during rotation.
type KekEntry = { version: number; material: string; key: CryptoKey };

let cachedKeks: { signature: string; entries: KekEntry[] } | null = null;

// Per-isolate cache for the imported AES-GCM key derived directly from
// the active KEK. Used by the legacy single-arg `encrypt`/`decrypt`
// path that pre-dates per-user DEKs. Re-imports on key rotation
// (`material` mismatch).
let cachedLegacyKey: { material: string; key: CryptoKey } | null = null;

const base64ToBytes = (b64: string): Uint8Array =>
	Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const bytesToBase64 = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes));

const readKekMaterial = (env: Env, version: number): string | undefined => {
	if (version === 1 && env.ENCRYPTION_KEY) {
		return env.ENCRYPTION_KEY;
	}
	const slot = `KEK_V${version}`;
	const value = (env as unknown as Record<string, string | undefined>)[slot];
	return value || undefined;
};

const importAesGcmKey = async (rawKey: Uint8Array): Promise<CryptoKey> =>
	crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);

const loadKeks = async (env: Env): Promise<KekEntry[]> => {
	const slots: Array<{ version: number; material: string }> = [];
	for (let v = 1; v < 32; v++) {
		const material = readKekMaterial(env, v);
		if (!material) break;
		slots.push({ version: v, material });
	}
	const signature = slots.map((s) => `${s.version}:${s.material}`).join("|");
	if (cachedKeks && cachedKeks.signature === signature) {
		return cachedKeks.entries;
	}
	const entries: KekEntry[] = [];
	for (const slot of slots) {
		const key = await importAesGcmKey(base64ToBytes(slot.material));
		entries.push({ version: slot.version, material: slot.material, key });
	}
	cachedKeks = { signature, entries };
	return entries;
};

const getKekByVersion = async (
	env: Env,
	version: number,
): Promise<CryptoKey> => {
	const entries = await loadKeks(env);
	const match = entries.find((e) => e.version === version);
	if (!match) {
		throw new Error(`KEK version ${version} not configured`);
	}
	return match.key;
};

export const getActiveKekVersion = async (env: Env): Promise<number> => {
	const entries = await loadKeks(env);
	if (entries.length === 0) {
		throw new Error("No KEK configured");
	}
	return entries[entries.length - 1].version;
};

export function isEncryptionEnabled(env: Env): boolean {
	return !!readKekMaterial(env, 1);
}

const getLegacyKey = async (env: Env): Promise<CryptoKey> => {
	const material = readKekMaterial(env, 1);
	if (!material) throw new Error("ENCRYPTION_KEY not configured");
	if (cachedLegacyKey && cachedLegacyKey.material === material) {
		return cachedLegacyKey.key;
	}
	const key = await importAesGcmKey(base64ToBytes(material));
	cachedLegacyKey = { material, key };
	return key;
};

const encryptWithKey = async (
	plaintext: string,
	key: CryptoKey,
): Promise<string> => {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	const combined = new Uint8Array(
		iv.length + new Uint8Array(ciphertext).length,
	);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return ENCRYPTED_PREFIX + bytesToBase64(combined);
};

const decryptWithKey = async (
	value: string,
	key: CryptoKey,
): Promise<string> => {
	const base64 = value.slice(ENCRYPTED_PREFIX.length);
	const combined = base64ToBytes(base64);
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		ciphertext,
	);
	return new TextDecoder().decode(decrypted);
};

const encryptBufferWithKey = async (
	data: ArrayBuffer,
	key: CryptoKey,
): Promise<ArrayBuffer> => {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data,
	);
	const combined = new Uint8Array(
		iv.length + new Uint8Array(ciphertext).length,
	);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return combined.buffer;
};

const decryptBufferWithKey = async (
	data: ArrayBuffer,
	key: CryptoKey,
): Promise<ArrayBuffer> => {
	const combined = new Uint8Array(data);
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
};

/**
 * The second arg to `encrypt`/`decrypt`/`encryptBuffer`/`decryptBuffer`
 * is always a per-user DEK (`CryptoKey`). It is set by the auth
 * middleware (`c.get("dek")`) for authed routes, or loaded explicitly
 * via `loadUserDek(row.userId, env)` in the public routes.
 *
 * The legacy single-key fallback was removed once per-user DEKs were
 * the only path. If you need to decrypt under the legacy KEK (e.g.
 * inside the one-shot migration worker), use `getLegacyKey` +
 * `decryptWithKey` / `decryptBufferWithKey` directly.
 */
export type EncryptionContext = CryptoKey;

export async function encrypt(
	plaintext: string,
	key: CryptoKey,
): Promise<string> {
	return encryptWithKey(plaintext, key);
}

export async function decrypt(value: string, key: CryptoKey): Promise<string> {
	if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
	return decryptWithKey(value, key);
}

export async function encryptBuffer(
	data: ArrayBuffer,
	key: CryptoKey,
): Promise<ArrayBuffer> {
	return encryptBufferWithKey(data, key);
}

export async function decryptBuffer(
	data: ArrayBuffer,
	key: CryptoKey,
): Promise<ArrayBuffer> {
	return decryptBufferWithKey(data, key);
}

// Exposed for the migration worker only — it decrypts legacy rows
// (encrypted under `ENCRYPTION_KEY` / `KEK_V1`) and re-encrypts them
// under the per-user DEK. Production routes should not touch these.
export { decryptBufferWithKey, decryptWithKey, getLegacyKey };

export function isEncrypted(value: string): boolean {
	return value.startsWith(ENCRYPTED_PREFIX);
}

// DEK wrapping primitives. A DEK is 32 raw bytes; wrapping produces
// a self-describing base64 string of `IV || ciphertext` analogous to
// the row-encryption format, but without the `enc:` prefix since
// `wrappedDek` is always stored in a dedicated column.

export const generateDek = (): Uint8Array => {
	const dek = new Uint8Array(32);
	crypto.getRandomValues(dek);
	return dek;
};

export const wrapDek = async (
	dek: Uint8Array,
	env: Env,
): Promise<{ wrapped: string; version: number }> => {
	const version = await getActiveKekVersion(env);
	const kek = await getKekByVersion(env, version);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		kek,
		dek.buffer as ArrayBuffer,
	);
	const combined = new Uint8Array(
		iv.length + new Uint8Array(ciphertext).length,
	);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return { wrapped: bytesToBase64(combined), version };
};

const unwrapDekToBytes = async (
	wrapped: string,
	version: number,
	env: Env,
): Promise<Uint8Array> => {
	const kek = await getKekByVersion(env, version);
	const combined = base64ToBytes(wrapped);
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);
	const dekBytes = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		kek,
		ciphertext,
	);
	return new Uint8Array(dekBytes);
};

export const unwrapDek = async (
	wrapped: string,
	version: number,
	env: Env,
): Promise<CryptoKey> => {
	const dekBytes = await unwrapDekToBytes(wrapped, version, env);
	return importAesGcmKey(dekBytes);
};

// HKDF-derived per-user HMAC key, used by hash.ts to pseudonymise
// IP/UA values in audit logs. Per-tenant salt prevents cross-tenant
// fingerprint correlation, and the derivation is stable across KEK
// rotations because the DEK doesn't change when its wrapping does.
const HMAC_INFO = new TextEncoder().encode("audit-hmac-v1");
const HKDF_SALT = new Uint8Array(0);

const deriveUserHmacKey = async (dekBytes: Uint8Array): Promise<CryptoKey> => {
	const hkdfKey = await crypto.subtle.importKey(
		"raw",
		dekBytes,
		"HKDF",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: HMAC_INFO },
		hkdfKey,
		{ name: "HMAC", hash: "SHA-256", length: 256 },
		false,
		["sign"],
	);
};

// Per-isolate LRU cache for unwrapped DEKs. The CryptoKey is
// non-extractable, so caching it is safe. Bounded so a hot worker
// serving many tenants doesn't grow unbounded. Each entry holds both
// the AES-GCM key (row encryption) and the HMAC key (audit-log
// pseudonymisation) so callers don't pay the unwrap+derive cost twice.
type DekEntry = { aes: CryptoKey; hmac: CryptoKey };
const DEK_CACHE_MAX = 64;
const dekCache = new Map<string, DekEntry>();

const cacheKey = (
	userId: number,
	kekVersion: number,
	wrapped: string,
): string => `${userId}:${kekVersion}:${wrapped}`;

const rememberDek = (key: string, entry: DekEntry): void => {
	dekCache.delete(key);
	dekCache.set(key, entry);
	if (dekCache.size > DEK_CACHE_MAX) {
		const oldest = dekCache.keys().next().value;
		if (oldest !== undefined) dekCache.delete(oldest);
	}
};

/**
 * Resolve the per-user key entry (AES-GCM for row encryption + HMAC for
 * audit-log pseudonymisation) or `null` when the user has not been
 * migrated yet. Single funnel used by both the authed `clerkAuth`
 * middleware and the public routes (`/invoice/*`, `/consent/*`) after
 * they resolve the owning user id from a row.
 */
const loadUserDekEntry = async (
	userId: number,
	env: Env,
): Promise<DekEntry | null> => {
	const db = getDb(env);
	const row = await db
		.prepare("SELECT wrappedDek, kekVersion FROM users WHERE id = ?")
		.bind(userId)
		.first<{ wrappedDek: string | null; kekVersion: number | null }>();
	if (!row || !row.wrappedDek || row.kekVersion == null) {
		return null;
	}
	const key = cacheKey(userId, row.kekVersion, row.wrappedDek);
	const cached = dekCache.get(key);
	if (cached) {
		dekCache.delete(key);
		dekCache.set(key, cached);
		return cached;
	}
	const dekBytes = await unwrapDekToBytes(row.wrappedDek, row.kekVersion, env);
	const entry: DekEntry = {
		aes: await importAesGcmKey(dekBytes),
		hmac: await deriveUserHmacKey(dekBytes),
	};
	rememberDek(key, entry);
	return entry;
};

export const loadUserDek = async (
	userId: number,
	env: Env,
): Promise<CryptoKey | null> => {
	const entry = await loadUserDekEntry(userId, env);
	return entry ? entry.aes : null;
};

export const loadUserHmacKey = async (
	userId: number,
	env: Env,
): Promise<CryptoKey | null> => {
	const entry = await loadUserDekEntry(userId, env);
	return entry ? entry.hmac : null;
};

/**
 * Mint and persist a new DEK for `userId` if one is not already set.
 * Idempotent at the DB level via `WHERE wrappedDek IS NULL`. Returns
 * the freshly imported `CryptoKey`, or `null` when the user already
 * had a DEK (caller can re-fetch via `loadUserDek`).
 *
 * Called by the auth middleware on every request when the user has no
 * DEK yet (first sign-in after PR5).
 */
export const provisionUserDek = async (
	userId: number,
	env: Env,
): Promise<CryptoKey | null> => {
	const dekBytes = generateDek();
	const { wrapped, version } = await wrapDek(dekBytes, env);
	const db = getDb(env);
	const result = await db
		.prepare(
			`UPDATE users
			   SET wrappedDek = ?, kekVersion = ?, dekCreatedAt = datetime('now')
			 WHERE id = ? AND wrappedDek IS NULL`,
		)
		.bind(wrapped, version, userId)
		.run();
	if (!result.meta.changes) {
		return null;
	}
	const entry: DekEntry = {
		aes: await importAesGcmKey(dekBytes),
		hmac: await deriveUserHmacKey(dekBytes),
	};
	rememberDek(cacheKey(userId, version, wrapped), entry);
	return entry.aes;
};
