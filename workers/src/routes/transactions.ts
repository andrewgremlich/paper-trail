import type { ResultSet } from "@libsql/client";
import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import { getCurrentUserId } from "../lib/userId";

const app = new Hono<{ Bindings: Env }>();

// GET /api/transactions?projectId=X - list transactions for a project
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const projectId = c.req.query("projectId");

	let result: ResultSet;

	if (projectId) {
		result = await db.execute({
			sql: `SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
				FROM transactions WHERE projectId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
			args: [Number(projectId), userId],
		});
	} else {
		result = await db.execute({
			sql: `SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
				FROM transactions WHERE userId = ? ORDER BY date ASC, createdAt ASC`,
			args: [userId],
		});
	}

	// Convert integer cents to dollars for UI
	return c.json(
		result.rows.map((r) => ({ ...r, amount: (r.amount as number) / 100 })),
	);
});

// GET /api/transactions/:id
app.get("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	const result = await db.execute({
		sql: `SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
			FROM transactions WHERE id = ? AND userId = ?`,
		args: [id, userId],
	});

	if (result.rows.length === 0) {
		return c.json({ error: "Transaction not found" }, 404);
	}

	const row = result.rows[0];
	return c.json({ ...row, amount: (row.amount as number) / 100 });
});

// POST /api/transactions - create transaction
app.post("/", async (c) => {
	const body = await c.req.json<{
		projectId: number;
		date: string;
		description: string;
		amount: number;
		filePath?: string;
	}>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const amountInCents = Math.round(body.amount * 100);

	await db.execute({
		sql: `INSERT INTO transactions (projectId, date, description, amount, filePath, userId)
			VALUES (?, ?, ?, ?, ?, ?)`,
		args: [
			body.projectId,
			body.date,
			body.description,
			amountInCents,
			body.filePath ?? null,
			userId,
		],
	});

	return c.json({ success: true }, 201);
});

// PUT /api/transactions/:id - update transaction
app.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{
		projectId: number;
		date: string;
		description: string;
		amount: number;
		filePath?: string;
	}>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const amountInCents = Math.round(body.amount * 100);

	await db.execute({
		sql: `UPDATE transactions
			SET projectId = ?, date = ?, description = ?, amount = ?, filePath = ?
			WHERE id = ? AND userId = ?`,
		args: [
			body.projectId,
			body.date,
			body.description,
			amountInCents,
			body.filePath ?? null,
			id,
			userId,
		],
	});

	return c.json({ success: true });
});

// DELETE /api/transactions/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	await db.execute({
		sql: "DELETE FROM transactions WHERE id = ? AND userId = ?",
		args: [id, userId],
	});

	return c.json({ success: true });
});

export { app as transactionRoutes };
