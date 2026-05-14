import { Hono } from "hono";
import { decrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Attachment, AttachmentStatus, Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

type AttachmentRow = {
	id: string;
	userId: number;
	originalName: string;
	contentType: string;
	sizeBytes: number;
	txId: string | null;
	attachedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

const statusFor = (row: AttachmentRow): AttachmentStatus => {
	if (row.attachedAt === null) return "pending";
	if (row.txId === null) return "orphaned";
	return "attached";
};

const decryptRow = async (
	row: AttachmentRow,
	env: Env,
): Promise<Attachment> => ({
	...row,
	originalName: await decrypt(row.originalName, env),
	status: statusFor(row),
});

// GET /api/v1/attachments — list all attachments for the user.
//
// The Files page renders this list. Pending uploads under the cron's
// PENDING_TTL are hidden so the casual "I just uploaded a file" state
// doesn't show up as an actionable row — they auto-clean. Anything older
// (uploaded but never attached, indicating an abandoned upload) is shown
// so the user can manually delete or wait for the sweeper.
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	// Hide very-fresh pending uploads — see comment above.
	const FRESH_PENDING_CUTOFF_MIN = 10;

	const { results } = await db
		.prepare(
			`SELECT id, userId, originalName, contentType, sizeBytes, txId, attachedAt, createdAt, updatedAt
			FROM attachments
			WHERE userId = ?
			  AND NOT (
			    attachedAt IS NULL
			    AND createdAt > datetime('now', ?)
			  )
			ORDER BY createdAt DESC`,
		)
		.bind(userId, `-${FRESH_PENDING_CUTOFF_MIN} minutes`)
		.all<AttachmentRow>();

	const attachments = await Promise.all(
		results.map((r: AttachmentRow) => decryptRow(r, c.env)),
	);
	return c.json(attachments);
});

// GET /api/v1/attachments/summary — totals for the Files page header.
app.get("/summary", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			`SELECT
			  COUNT(*) AS total,
			  COALESCE(SUM(sizeBytes), 0) AS totalBytes,
			  SUM(CASE WHEN txId IS NOT NULL AND attachedAt IS NOT NULL THEN 1 ELSE 0 END) AS attached,
			  SUM(CASE WHEN txId IS NULL AND attachedAt IS NOT NULL THEN 1 ELSE 0 END) AS orphaned,
			  SUM(CASE WHEN attachedAt IS NULL THEN 1 ELSE 0 END) AS pending
			FROM attachments
			WHERE userId = ?`,
		)
		.bind(userId)
		.first<{
			total: number;
			totalBytes: number;
			attached: number;
			orphaned: number;
			pending: number;
		}>();

	return c.json(
		row ?? { total: 0, totalBytes: 0, attached: 0, orphaned: 0, pending: 0 },
	);
});

export { app as attachmentRoutes };
