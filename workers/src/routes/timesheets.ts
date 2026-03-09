import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import { getCurrentUserId } from "../lib/userId";

const app = new Hono<{ Bindings: Env }>();

// GET /api/timesheets - list all timesheets
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const result = await db.execute({
		sql: `SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE userId = ? ORDER BY createdAt DESC`,
		args: [userId],
	});
	return c.json(result.rows.map((r) => ({ ...r, active: !!r.active })));
});

// GET /api/timesheets/:id - get timesheet with entries
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const timesheetId = Number(c.req.param("id"));

	const headerResult = await db.execute({
		sql: `SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			p.customerId as customerId, p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.id = ? AND t.userId = ?`,
		args: [timesheetId, userId],
	});

	if (headerResult.rows.length === 0) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	const header = headerResult.rows[0];

	const entriesResult = await db.execute({
		sql: `SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
			FROM timesheet_entries WHERE timesheetId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
		args: [timesheetId, userId],
	});

	// Convert amount from integer cents to dollars for UI
	const entries = entriesResult.rows.map((e) => ({
		...e,
		amount: (e.amount as number) / 100,
	}));

	return c.json({
		...header,
		active: !!header.active,
		entries,
	});
});

// GET /api/timesheets/by-invoice/:invoiceId
app.get("/by-invoice/:invoiceId", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const invoiceId = c.req.param("invoiceId");

	const result = await db.execute({
		sql: `SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			p.customerId as customerId, p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.invoiceId = ? AND t.userId = ?`,
		args: [invoiceId, userId],
	});

	if (result.rows.length === 0) {
		return c.json(null);
	}

	return c.json({ ...result.rows[0], active: !!result.rows[0].active });
});

// POST /api/timesheets - create timesheet
app.post("/", async (c) => {
	const body = await c.req.json<{
		projectId: number;
		name: string;
		description?: string;
	}>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	const insertResult = await db.execute({
		sql: `INSERT INTO timesheets (projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?)`,
		args: [body.projectId, body.name, body.description ?? null, 1, userId],
	});

	const row = await db.execute({
		sql: `SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		args: [insertResult.lastInsertRowid, userId],
	});

	return c.json({ ...row.rows[0], active: !!row.rows[0].active }, 201);
});

// PUT /api/timesheets/:id - update timesheet
app.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{
		name: string;
		description?: string;
		active: boolean;
	}>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	await db.execute({
		sql: `UPDATE timesheets
			SET name = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		args: [
			body.name,
			body.description ?? null,
			body.active ? 1 : 0,
			id,
			userId,
		],
	});

	const updated = await db.execute({
		sql: `SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		args: [id, userId],
	});

	if (updated.rows.length === 0) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	return c.json({ ...updated.rows[0], active: !!updated.rows[0].active });
});

// DELETE /api/timesheets/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	await db.execute({
		sql: "DELETE FROM timesheets WHERE id = ? AND userId = ?",
		args: [id, userId],
	});

	return c.json({ success: true });
});

export { app as timesheetRoutes };
