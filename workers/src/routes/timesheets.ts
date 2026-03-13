import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/timesheets - list all timesheets
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const { results } = await db
		.prepare(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE userId = ? ORDER BY createdAt DESC`,
		)
		.bind(userId)
		.all();
	return c.json(results.map((r: Record<string, unknown>) => ({ ...r, active: !!r.active })));
});

// GET /api/timesheets/:id - get timesheet with entries
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const timesheetId = Number(c.req.param("id"));

	const header = await db
		.prepare(
			`SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			p.customerId as customerId, p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.id = ? AND t.userId = ?`,
		)
		.bind(timesheetId, userId)
		.first();

	if (!header) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	const { results: entriesRows } = await db
		.prepare(
			`SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
			FROM timesheet_entries WHERE timesheetId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
		)
		.bind(timesheetId, userId)
		.all();

	// Convert amount from integer cents to dollars for UI
	const entries = entriesRows.map((e: Record<string, unknown>) => ({
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
	const userId = c.get("userId");
	const invoiceId = c.req.param("invoiceId");

	const result = await db
		.prepare(
			`SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			p.customerId as customerId, p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.invoiceId = ? AND t.userId = ?`,
		)
		.bind(invoiceId, userId)
		.first();

	if (!result) {
		return c.json(null);
	}

	return c.json({ ...result, active: !!result.active });
});

// POST /api/timesheets - create timesheet
app.post("/", async (c) => {
	const body = await c.req.json<{
		projectId: number;
		name: string;
		description?: string;
	}>();
	const db = getDb(c.env);
	const userId = c.get("userId");

	const insertResult = await db
		.prepare(
			`INSERT INTO timesheets (projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(body.projectId, body.name, body.description ?? null, 1, userId)
		.run();

	const row = await db
		.prepare(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(insertResult.meta.last_row_id, userId)
		.first();

	return c.json({ ...row, active: !!row!.active }, 201);
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
	const userId = c.get("userId");

	await db
		.prepare(
			`UPDATE timesheets
			SET name = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		)
		.bind(body.name, body.description ?? null, body.active ? 1 : 0, id, userId)
		.run();

	const updated = await db
		.prepare(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first();

	if (!updated) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	return c.json({ ...updated, active: !!updated.active });
});

// DELETE /api/timesheets/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db.prepare("DELETE FROM timesheets WHERE id = ? AND userId = ?").bind(id, userId).run();

	return c.json({ success: true });
});

export { app as timesheetRoutes };
