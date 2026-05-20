/**
 * Pseudonymisation helpers — hash PII (IPs, UAs) before storing it in audit logs
 * so we keep a stable fingerprint without keeping the raw value.
 *
 * `hmacSha256Hex` is the standard primitive for "stable fingerprint of a string
 * keyed by a secret" and is used for all new writes. `sha256Hex` is the older
 * `H(salt || msg)` prefix-MAC construction; it is kept exported so historical
 * `consentIpHash` / `consentUaHash` / event-payload values written before the
 * §14 cutover can still be recomputed and compared if we ever need to.
 *
 * New audit-log payloads carry `{ "v": 2, ... }` so the format used to compute
 * a hash can be told apart from rows missing the `v` field (implicitly v1).
 */

import type { Env } from "./types";

const toHex = (bytes: Uint8Array): string =>
	Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

/**
 * Pseudonymisation primitive — HMAC-SHA-256 keyed by a per-user HMAC
 * `CryptoKey` (derived from the user's DEK via HKDF; see
 * `loadUserHmacKey` in crypto.ts). Per-tenant key prevents cross-tenant
 * fingerprint correlation and survives KEK rotation because the DEK
 * doesn't change when its wrapping does.
 */
export const hmacSha256Hex = async (
	input: string,
	key: CryptoKey,
): Promise<string> => {
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(input),
	);
	return toHex(new Uint8Array(mac));
};

/**
 * Legacy pseudonymisation primitive — `SHA-256(ENCRYPTION_KEY || input)`.
 * Kept only so we can recompute hashes for v1 rows (those without `"v": 2` in
 * their payload). Do not use for new writes — prefer `hmacSha256Hex`.
 */
export const sha256Hex = async (
	input: string,
	env: Env,
): Promise<string> => {
	const salt = env.ENCRYPTION_KEY ?? "";
	const data = new TextEncoder().encode(salt + input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return toHex(new Uint8Array(digest));
};

export const randomHexToken = (bytes = 32): string => {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return toHex(buf);
};

/**
 * Constant-time string equality. Always scans `max(a, b)` bytes so the
 * runtime doesn't leak a prefix-match-length signal even when the
 * provided value is shorter than the expected one.
 */
export const constantTimeEqual = (a: string, b: string): boolean => {
	const aBytes = new TextEncoder().encode(a);
	const bBytes = new TextEncoder().encode(b);
	let diff = aBytes.length ^ bBytes.length;
	const max = Math.max(aBytes.length, bBytes.length);
	for (let i = 0; i < max; i++) {
		diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
	}
	return diff === 0;
};
