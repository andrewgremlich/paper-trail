import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM users WHERE id = ?",
		)
		.bind(userId)
		.first();

	if (!row) {
		return c.json({ error: "User not found" }, 404);
	}

	return c.json(row);
});

// PUT /api/user-profile
app.put("/", async (c) => {
	const body = await c.req.json<{
		displayName: string;
		email: string;
	}>();
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("UPDATE users SET displayName = ?, email = ? WHERE id = ?")
		.bind(body.displayName, body.email, userId)
		.run();

	const updated = await db
		.prepare(
			"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM users WHERE id = ?",
		)
		.bind(userId)
		.first();

	return c.json(updated);
});

// DELETE /api/user-profile — wipe all user-generated data (keeps account)
app.delete("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	// Collect R2 keys from all transactions before deleting DB rows
	const { results: txRows } = await db
		.prepare("SELECT filePath FROM transactions WHERE userId = ? AND filePath IS NOT NULL AND filePath != ''")
		.bind(userId)
		.all<{ filePath: string }>();

	const r2Keys = txRows
		.map((r) => r.filePath)
		.filter((p) => !/^https?:\/\//i.test(p));

	// Delete R2 objects in parallel
	await Promise.all(r2Keys.map((key) => c.env.FILES_BUCKET.delete(key)));

	// Projects cascade to timesheets, timesheet_entries, and transactions
	await db
		.prepare("DELETE FROM projects WHERE userId = ?")
		.bind(userId)
		.run();

	// Transactions not linked to a project (e.g. created directly)
	await db
		.prepare("DELETE FROM transactions WHERE userId = ?")
		.bind(userId)
		.run();

	await db
		.prepare("DELETE FROM stripe_connections WHERE userId = ?")
		.bind(userId)
		.run();

	return c.json({ deleted: true });
});

export { app as userProfileRoutes };
