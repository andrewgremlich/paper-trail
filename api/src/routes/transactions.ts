import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

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
			.bind(Number(projectId), userId)
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

	// Convert integer cents to dollars for UI
	return c.json(
		results.map((r) => ({ ...r, amount: (r.amount as number) / 100 })),
	);
});

// GET /api/transactions/:id
app.get("/:id", async (c) => {
	const id = Number(c.req.param("id"));
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
	const userId = c.get("userId");
	const amountInCents = Math.round(body.amount * 100);

	await db
		.prepare(
			`INSERT INTO transactions (projectId, date, description, amount, filePath, userId)
			VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			body.projectId,
			body.date,
			body.description,
			amountInCents,
			body.filePath ?? null,
			userId,
		)
		.run();

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
	const userId = c.get("userId");
	const amountInCents = Math.round(body.amount * 100);

	await db
		.prepare(
			`UPDATE transactions
			SET projectId = ?, date = ?, description = ?, amount = ?, filePath = ?
			WHERE id = ? AND userId = ?`,
		)
		.bind(
			body.projectId,
			body.date,
			body.description,
			amountInCents,
			body.filePath ?? null,
			id,
			userId,
		)
		.run();

	return c.json({ success: true });
});

// DELETE /api/transactions/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM transactions WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as transactionRoutes };
