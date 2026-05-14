/**
 * Pseudonymisation helpers — hash PII (IPs, UAs) before storing it in audit logs
 * so we keep a stable fingerprint without keeping the raw value.
 *
 * Uses SHA-256 with the ENCRYPTION_KEY as a salt so hashes can't be precomputed
 * against IP-range rainbow tables by anyone who steals just the database.
 */

import type { Env } from "./types";

export const sha256Hex = async (
	input: string,
	env: Env,
): Promise<string> => {
	const salt = env.ENCRYPTION_KEY ?? "";
	const data = new TextEncoder().encode(salt + input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
};

export const randomHexToken = (bytes = 32): string => {
	const buf = new Uint8Array(bytes);
	crypto.getRandomValues(buf);
	return Array.from(buf)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
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
