import { loadUserHmacKey } from "./crypto";
import { hmacSha256Hex } from "./hash";
import type { Env } from "./types";

const SENDS_PER_HOUR = 30;
// Daily cap on unique recipient addresses per user. Protects shared
// sending-domain reputation against a single account being used to
// spray fresh addresses (cold-list mail-bombing).
const RECIPIENTS_PER_DAY = 50;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class RateLimitError extends Error {
	readonly retryAfterSeconds: number;
	constructor(retryAfterSeconds: number) {
		super("Send rate limit exceeded");
		this.name = "RateLimitError";
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/**
 * Throws RateLimitError if `userId` has exceeded the per-hour send limit
 * or — when `recipientEmail` is supplied — the per-day unique-recipient
 * cap. Records the send timestamp (with hashed recipient) on success.
 *
 * Uses a rolling window via `send_rate_log` — cheap because we purge
 * rows older than the longest window on every check.
 */
export const assertWithinSendLimit = async (
	userId: number,
	env: Env,
	recipientEmail?: string,
): Promise<void> => {
	const db = env.DB;
	const now = Date.now();
	const oneHourAgo = new Date(now - ONE_HOUR_MS).toISOString();
	const oneDayAgo = new Date(now - ONE_DAY_MS).toISOString();

	// Trim old rows for this user before counting. Keep 24h so the
	// per-recipient counter has its window.
	await db
		.prepare("DELETE FROM send_rate_log WHERE userId = ? AND sentAt < ?")
		.bind(userId, oneDayAgo)
		.run();

	const row = await db
		.prepare(
			"SELECT COUNT(*) as count FROM send_rate_log WHERE userId = ? AND sentAt >= ?",
		)
		.bind(userId, oneHourAgo)
		.first<{ count: number }>();

	const count = row?.count ?? 0;
	if (count >= SENDS_PER_HOUR) {
		// Find the oldest send still inside the window — the user is unlocked
		// once that row falls out.
		const oldest = await db
			.prepare(
				"SELECT sentAt FROM send_rate_log WHERE userId = ? AND sentAt >= ? ORDER BY sentAt ASC LIMIT 1",
			)
			.bind(userId, oneHourAgo)
			.first<{ sentAt: string }>();
		const oldestMs = oldest ? Date.parse(oldest.sentAt) : now;
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((oldestMs + ONE_HOUR_MS - now) / 1000),
		);
		throw new RateLimitError(retryAfterSeconds);
	}

	let recipientHash: string | null = null;
	if (recipientEmail) {
		const hmacKey = await loadUserHmacKey(userId, env);
		if (!hmacKey) {
			throw new Error("User HMAC key unavailable — DEK not provisioned");
		}
		recipientHash = await hmacSha256Hex(
			recipientEmail.trim().toLowerCase(),
			hmacKey,
		);
		// Distinct recipient addresses this user has emailed in the last
		// 24h. Counts the current recipient once even if they were already
		// included (idempotent — we only block when they're trying to add a
		// *new* one beyond the cap).
		const recipients = await db
			.prepare(
				`SELECT COUNT(DISTINCT recipientHash) as count
				 FROM send_rate_log
				 WHERE userId = ? AND sentAt >= ? AND recipientHash IS NOT NULL
				   AND recipientHash != ?`,
			)
			.bind(userId, oneDayAgo, recipientHash)
			.first<{ count: number }>();
		const distinctOther = recipients?.count ?? 0;
		if (distinctOther >= RECIPIENTS_PER_DAY) {
			const oldest = await db
				.prepare(
					"SELECT sentAt FROM send_rate_log WHERE userId = ? AND sentAt >= ? ORDER BY sentAt ASC LIMIT 1",
				)
				.bind(userId, oneDayAgo)
				.first<{ sentAt: string }>();
			const oldestMs = oldest ? Date.parse(oldest.sentAt) : now;
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil((oldestMs + ONE_DAY_MS - now) / 1000),
			);
			throw new RateLimitError(retryAfterSeconds);
		}
	}

	await db
		.prepare(
			"INSERT INTO send_rate_log (userId, recipientHash) VALUES (?, ?)",
		)
		.bind(userId, recipientHash)
		.run();
};
