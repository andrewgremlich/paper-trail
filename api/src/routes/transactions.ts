import { Hono } from "hono";
import { z } from "zod";
// SheetJS (`xlsx`) is pinned to 0.18.5 (no caret) in package.json so a
// future patch release can't sneak in. SheetJS has historically had
// parse-time advisories; we only ever *write* xlsx (here and in the
// frontend export), and never call `XLSX.read*` on untrusted input, so
// those CVEs don't currently apply. Re-evaluate before adding a parse
// path — see docs/SECURITY_REMAINING.md §16.
import * as XLSX from "xlsx";
import {
	decrypt,
	type EncryptionContext,
	encrypt,
	isEncryptionEnabled,
} from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import {
	descriptionSchema,
	dollarAmountSchema,
	filePathSchema,
	isoDateSchema,
	userOwnsProject,
	uuidSchema,
} from "../lib/validators";
import type { AuthVariables } from "../middleware/auth";

const transactionBodySchema = z.object({
	projectId: uuidSchema,
	date: isoDateSchema,
	description: descriptionSchema,
	amount: dollarAmountSchema,
	filePath: filePathSchema,
});

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

async function decryptTransaction(
	row: Record<string, unknown>,
	ctx: EncryptionContext,
	env: Env,
): Promise<Record<string, unknown>> {
	const description = await decrypt(row.description as string, ctx);
	const amount = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount as string, ctx))
		: (row.amount as number);

	return { ...row, description, amount: amount / 100 };
}

// GET /api/transactions?projectId=X - list transactions for a project
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek") ?? c.env;
	const projectId = c.req.query("projectId");

	let results: Record<string, unknown>[];

	if (projectId) {
		const res = await db
			.prepare(
				`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
				FROM transactions WHERE projectId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
			)
			.bind(projectId, userId)
			.all();
		results = res.results;
	} else {
		const res = await db
			.prepare(
				`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
				FROM transactions WHERE userId = ? ORDER BY date ASC, createdAt ASC`,
			)
			.bind(userId)
			.all();
		results = res.results;
	}

	const decrypted = await Promise.all(
		results.map((r) => decryptTransaction(r, enc, c.env)),
	);

	return c.json(decrypted);
});

// GET /api/v1/transactions/xlsx - download all transactions as XLSX
app.get("/xlsx", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek") ?? c.env;

	const { results } = await db
		.prepare(
			`SELECT t.id, t.date, t.description, t.amount, p.name AS projectName
			FROM transactions t
			LEFT JOIN projects p ON t.projectId = p.id
			WHERE t.userId = ?
			ORDER BY t.date ASC, t.createdAt ASC`,
		)
		.bind(userId)
		.all();

	const rows = await Promise.all(
		results.map(async (r: Record<string, unknown>) => {
			const description = await decrypt(r.description as string, enc);
			const amount = isEncryptionEnabled(c.env)
				? Number(await decrypt(r.amount as string, enc))
				: (r.amount as number);

			return {
				Date: r.date as string,
				Project: (r.projectName as string) ?? "",
				Description: description,
				Amount: amount / 100,
			};
		}),
	);

	const worksheet = XLSX.utils.json_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

	const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

	return new Response(buffer, {
		headers: {
			"Content-Type":
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": 'attachment; filename="transactions.xlsx"',
		},
	});
});

// GET /api/v1/transactions/:id
app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek") ?? c.env;

	const row = await db
		.prepare(
			`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
			FROM transactions WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first();

	if (!row) {
		return c.json({ error: "Transaction not found" }, 404);
	}

	const decrypted = await decryptTransaction(
		row as Record<string, unknown>,
		enc,
		c.env,
	);
	return c.json(decrypted);
});

// POST /api/v1/transactions - create transaction
app.post("/", async (c) => {
	const parsed = transactionBodySchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid transaction", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek") ?? c.env;

	if (!(await userOwnsProject(c.env, body.projectId, userId))) {
		return c.json({ error: "Project not found" }, 404);
	}

	// External (http(s)) filePaths are legacy and not tracked in
	// attachments. Only internal R2 keys link into the attachments table.
	const internalFilePath =
		body.filePath && !/^https?:\/\//i.test(body.filePath)
			? body.filePath
			: null;

	if (internalFilePath) {
		// Verify the caller actually owns the attachment they're linking.
		// Without this check, a caller could attach another tenant's
		// pending upload to their own transaction and then download it.
		const owned = await db
			.prepare(
				"SELECT 1 AS ok FROM attachments WHERE id = ? AND userId = ? LIMIT 1",
			)
			.bind(internalFilePath, userId)
			.first<{ ok: number }>();
		if (!owned?.ok) {
			return c.json({ error: "Attachment not found" }, 404);
		}
	}

	const amountInCents = Math.round(body.amount * 100);
	const id = crypto.randomUUID();

	const encDescription = await encrypt(body.description, enc);
	const encAmount = await encrypt(String(amountInCents), enc);

	await db
		.prepare(
			`INSERT INTO transactions (id, projectId, date, description, amount, filePath, userId)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			body.projectId,
			body.date,
			encDescription,
			encAmount,
			body.filePath ?? null,
			userId,
		)
		.run();

	// Mark the attachment as attached. Doing this AFTER the transaction
	// insert means a failed insert leaves the attachment pending — the
	// cron will clean it up after PENDING_TTL.
	if (internalFilePath) {
		await db
			.prepare(
				`UPDATE attachments SET txId = ?, attachedAt = COALESCE(attachedAt, datetime('now'))
				WHERE id = ? AND userId = ?`,
			)
			.bind(id, internalFilePath, userId)
			.run();
	}

	return c.json({ success: true, id }, 201);
});

// PUT /api/v1/transactions/:id - update transaction
app.put("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = transactionBodySchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid transaction", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek") ?? c.env;

	if (!(await userOwnsProject(c.env, body.projectId, userId))) {
		return c.json({ error: "Project not found" }, 404);
	}

	const newInternalFilePath =
		body.filePath && !/^https?:\/\//i.test(body.filePath)
			? body.filePath
			: null;

	// Look up the previous filePath so we can orphan the old attachment if
	// it's being replaced or cleared. Reading-before-writing is fine here
	// because the user already owns this row (the WHERE clause below
	// enforces it) and there's no concurrent path that mutates filePath
	// for the same row.
	const prev = await db
		.prepare(
			"SELECT filePath FROM transactions WHERE id = ? AND userId = ?",
		)
		.bind(id, userId)
		.first<{ filePath: string | null }>();

	if (!prev) {
		return c.json({ error: "Transaction not found" }, 404);
	}

	if (newInternalFilePath) {
		const owned = await db
			.prepare(
				"SELECT 1 AS ok FROM attachments WHERE id = ? AND userId = ? LIMIT 1",
			)
			.bind(newInternalFilePath, userId)
			.first<{ ok: number }>();
		if (!owned?.ok) {
			return c.json({ error: "Attachment not found" }, 404);
		}
	}

	const amountInCents = Math.round(body.amount * 100);

	const encDescription = await encrypt(body.description, enc);
	const encAmount = await encrypt(String(amountInCents), enc);

	await db
		.prepare(
			`UPDATE transactions
			SET projectId = ?, date = ?, description = ?, amount = ?, filePath = ?
			WHERE id = ? AND userId = ?`,
		)
		.bind(
			body.projectId,
			body.date,
			encDescription,
			encAmount,
			body.filePath ?? null,
			id,
			userId,
		)
		.run();

	// If the filePath changed and the previous one was an internal R2 key,
	// orphan its attachment row. The cron sweeper will delete the R2
	// object and the row after the orphan grace period.
	const prevInternal =
		prev.filePath && !/^https?:\/\//i.test(prev.filePath)
			? prev.filePath
			: null;
	if (prevInternal && prevInternal !== newInternalFilePath) {
		await db
			.prepare(
				"UPDATE attachments SET txId = NULL WHERE id = ? AND userId = ?",
			)
			.bind(prevInternal, userId)
			.run();
	}

	if (newInternalFilePath && newInternalFilePath !== prevInternal) {
		await db
			.prepare(
				`UPDATE attachments SET txId = ?, attachedAt = COALESCE(attachedAt, datetime('now'))
				WHERE id = ? AND userId = ?`,
			)
			.bind(id, newInternalFilePath, userId)
			.run();
	}

	return c.json({ success: true });
});

// DELETE /api/v1/transactions/:id
//
// The attachments FK uses ON DELETE SET NULL, so deleting the transaction
// automatically orphans the linked attachment (txId becomes NULL). The
// cron sweeper then removes the R2 object + row after the orphan grace
// period — no work needed here beyond the row delete.
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM transactions WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as transactionRoutes };
