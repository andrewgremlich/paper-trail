/**
 * Cron sweep — keeps the attachments table and R2 bucket in sync.
 *
 * Runs on the schedule defined in wrangler.jsonc → triggers.crons. For
 * each user-owned attachment in a deletable state, removes the R2 object
 * AND the DB row in lockstep so neither side can dangle.
 *
 * Two states get cleaned:
 *
 *   1. PENDING — attachedAt IS NULL AND createdAt < now - PENDING_TTL.
 *      The user uploaded a file but never finished saving the
 *      transaction (closed the tab, lost connection, etc.). After the
 *      TTL the upload is considered abandoned.
 *
 *   2. ORPHANED — txId IS NULL AND attachedAt IS NOT NULL AND
 *      attachedAt < now - ORPHAN_GRACE_PERIOD.
 *      The attachment was once linked to a transaction but no longer is
 *      (transaction was deleted or its file was replaced). The grace
 *      period gives the user a window to recover via the Files page.
 *
 * The sweep is bounded per run so a runaway dataset can't make a single
 * invocation hit Worker CPU/wall-time limits — leftovers get picked up
 * on the next tick.
 *
 * R2.delete is idempotent (no error if the key is already gone), so a
 * partial-failure retry is safe: the row is the source of truth, and we
 * always delete the R2 object before the row.
 */

import type { Env } from "./lib/types";

const PENDING_TTL_MIN = 60; // 1h grace for abandoned uploads
const ORPHAN_GRACE_HOURS = 24; // 24h to recover an unlinked attachment
const MAX_DELETES_PER_RUN = 500;

type SweepCandidate = { id: string };

export async function runAttachmentSweep(env: Env): Promise<{
	pendingDeleted: number;
	orphanedDeleted: number;
}> {
	const db = env.DB;

	const { results: pending } = await db
		.prepare(
			`SELECT id FROM attachments
			WHERE attachedAt IS NULL
			  AND createdAt < datetime('now', ?)
			LIMIT ?`,
		)
		.bind(`-${PENDING_TTL_MIN} minutes`, MAX_DELETES_PER_RUN)
		.all<SweepCandidate>();

	const remaining = MAX_DELETES_PER_RUN - pending.length;
	const { results: orphaned } =
		remaining > 0
			? await db
					.prepare(
						`SELECT id FROM attachments
						WHERE txId IS NULL
						  AND attachedAt IS NOT NULL
						  AND attachedAt < datetime('now', ?)
						LIMIT ?`,
					)
					.bind(`-${ORPHAN_GRACE_HOURS} hours`, remaining)
					.all<SweepCandidate>()
			: { results: [] as SweepCandidate[] };

	const all = [...pending, ...orphaned];

	// Delete R2 first, DB row second, per attachment. If R2.delete throws
	// we leave the DB row in place so the next sweep retries it (rather
	// than dropping the row and leaking the R2 object).
	await Promise.all(
		all.map(async ({ id }) => {
			try {
				await env.FILES_BUCKET.delete(id);
				await db.prepare("DELETE FROM attachments WHERE id = ?").bind(id).run();
			} catch (err) {
				console.error("attachment sweep failed for id", id, err);
			}
		}),
	);

	return {
		pendingDeleted: pending.length,
		orphanedDeleted: orphaned.length,
	};
}
