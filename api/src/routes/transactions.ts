import { Hono } from "hono";
import { z } from "zod";
// SheetJS (`xlsx`) is pinned to 0.18.5 (no caret) in package.json so a
// future patch release can't sneak in. SheetJS has historically had
// parse-time advisories; we only ever *write* xlsx (here and in the
// frontend export), and never call `XLSX.read*` on untrusted input, so
// those CVEs don't currently apply. Re-evaluate before adding a parse
// path — see docs/SECURITY_REMAINING.md §16.
import * as XLSX from "xlsx";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
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
	env: Env,
): Promise<Record<string, unknown>> {
	const description = await decrypt(row.description as string, env);
	const amount = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount as string, env))
		: (row.amount as number);

	return { ...row, description, amount: amount / 100 };
}

// GET /api/transactions?projectId=X - list transactions for a project
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
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
		results.map((r) => decryptTransaction(r, c.env)),
	);

	return c.json(decrypted);
});

// GET /api/v1/transactions/xlsx - download all transactions as XLSX
app.get("/xlsx", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

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
			const description = await decrypt(r.description as string, c.env);
			const amount = isEncryptionEnabled(c.env)
				? Number(await decrypt(r.amount as string, c.env))
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

	if (!(await userOwnsProject(c.env, body.projectId, userId))) {
		return c.json({ error: "Project not found" }, 404);
	}

	const amountInCents = Math.round(body.amount * 100);
	const id = crypto.randomUUID();

	const encDescription = await encrypt(body.description, c.env);
	const encAmount = await encrypt(String(amountInCents), c.env);

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

	if (!(await userOwnsProject(c.env, body.projectId, userId))) {
		return c.json({ error: "Project not found" }, 404);
	}

	const amountInCents = Math.round(body.amount * 100);

	const encDescription = await encrypt(body.description, c.env);
	const encAmount = await encrypt(String(amountInCents), c.env);

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

	return c.json({ success: true });
});

// DELETE /api/v1/transactions/:id
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
