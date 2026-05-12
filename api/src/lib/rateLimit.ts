import type { Env } from "./types";

const SENDS_PER_HOUR = 30;

export class RateLimitError extends Error {
	readonly retryAfterSeconds: number;
	constructor(retryAfterSeconds: number) {
		super("Send rate limit exceeded");
		this.name = "RateLimitError";
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

/**
 * Throws RateLimitError if `userId` has exceeded the per-hour send limit.
 * Records the send timestamp on success. Uses a rolling 1-hour window
 * via the `send_rate_log` table — cheap because we purge rows older than
 * the window on every check.
 */
export const assertWithinSendLimit = async (
	userId: number,
	env: Env,
): Promise<void> => {
	const db = env.DB;
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

	// Trim old rows for this user before counting.
	await db
		.prepare("DELETE FROM send_rate_log WHERE userId = ? AND sentAt < ?")
		.bind(userId, oneHourAgo)
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
		const oldestMs = oldest ? Date.parse(oldest.sentAt) : Date.now();
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((oldestMs + 60 * 60 * 1000 - Date.now()) / 1000),
		);
		throw new RateLimitError(retryAfterSeconds);
	}

	await db
		.prepare("INSERT INTO send_rate_log (userId) VALUES (?)")
		.bind(userId)
		.run();
};
