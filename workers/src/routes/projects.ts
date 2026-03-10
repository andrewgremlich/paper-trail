import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env, Project } from "../lib/types";
import { getCurrentUserId } from "../lib/userId";

const app = new Hono<{ Bindings: Env }>();

// GET /api/projects - list all projects
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const result = await db.execute({
		sql: `SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE userId = ? ORDER BY createdAt DESC`,
		args: [userId],
	});
	const rows = result.rows.map((r) => ({ ...r, active: !!r.active }));
	return c.json(rows);
});

// GET /api/projects/:id - get project with timesheets
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const projectId = Number(c.req.param("id"));

	const projectResult = await db.execute({
		sql: `SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		args: [projectId, userId],
	});

	if (projectResult.rows.length === 0) {
		return c.json({ error: "Project not found" }, 404);
	}

	const project = {
		...projectResult.rows[0],
		active: !!projectResult.rows[0].active,
	};

	const timesheetResult = await db.execute({
		sql: `SELECT id, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE projectId = ? AND userId = ? ORDER BY createdAt DESC`,
		args: [projectId, userId],
	});

	const timesheets = timesheetResult.rows.map((t) => ({
		...t,
		active: !!t.active,
	}));

	return c.json({ ...project, timesheets });
});

// POST /api/projects - create project, optionally with initial timesheet
// Query params: ?createTimesheet=true (default: false)
app.post("/", async (c) => {
	const body = await c.req.json<{
		name: string;
		customerId: string;
		rate_in_cents: number;
		description: string;
	}>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	const insertResult = await db.execute({
		sql: `INSERT INTO projects (name, customerId, rate_in_cents, description, userId)
			VALUES (?, ?, ?, ?, ?)`,
		args: [
			body.name,
			body.customerId,
			body.rate_in_cents,
			body.description,
			userId,
		],
	});
	const createdProjectId = insertResult.lastInsertRowid;

	if (!createdProjectId) {
		return c.json({ error: "Failed to create project" }, 500);
	}

	const projectResult = await db.execute({
		sql: `SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		args: [createdProjectId, userId],
	});
	const project = {
		...projectResult.rows[0],
		active: !!projectResult.rows[0].active,
	};

	const createTimesheet = c.req.query("createTimesheet") === "true";

	if (!createTimesheet) {
		return c.json({ project, timesheet: null }, 201);
	}

	const timesheetName = `${new Date().toLocaleDateString()} Timesheet`;
	const tsResult = await db.execute({
		sql: `INSERT INTO timesheets (projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?)`,
		args: [createdProjectId, timesheetName, "Initial timesheet", 1, userId],
	});

	if (!tsResult.lastInsertRowid) {
		return c.json({ project, timesheet: null }, 201);
	}

	const tsRow = await db.execute({
		sql: `SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		args: [tsResult.lastInsertRowid, userId],
	});
	const timesheet = { ...tsRow.rows[0], active: !!tsRow.rows[0].active };

	return c.json({ project, timesheet }, 201);
});

// PUT /api/projects/:id - update project
app.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<Project>();
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);
	const rate = body.rate_in_cents ?? 0;

	if (!body.name || !body.customerId || rate < 0) {
		return c.json({ error: "Invalid project data" }, 400);
	}

	await db.execute({
		sql: `UPDATE projects
			SET name = ?, customerId = ?, rate_in_cents = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		args: [
			body.name,
			body.customerId,
			rate * 100,
			body.description ?? "",
			body.active ? 1 : 0,
			id,
			userId,
		],
	});

	const updated = await db.execute({
		sql: `SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		args: [id, userId],
	});

	if (updated.rows.length === 0) {
		return c.json({ error: "Project not found" }, 404);
	}

	return c.json({ ...updated.rows[0], active: !!updated.rows[0].active });
});

// DELETE /api/projects/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	await db.execute({
		sql: "DELETE FROM projects WHERE id = ? AND userId = ?",
		args: [id, userId],
	});

	return c.json({ success: true });
});

export { app as projectRoutes };
