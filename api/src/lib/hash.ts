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
