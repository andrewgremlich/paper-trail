import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env, Project } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/projects - list all projects
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const { results } = await db
		.prepare(
			`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE userId = ? ORDER BY createdAt DESC`,
		)
		.bind(userId)
		.all();
	const rows = results.map((r: Record<string, unknown>) => ({
		...r,
		active: !!r.active,
	}));
	return c.json(rows);
});

// GET /api/projects/:id - get project with timesheets
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const projectId = Number(c.req.param("id"));

	const project = await db
		.prepare(
			`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		)
		.bind(projectId, userId)
		.first();

	if (!project) {
		return c.json({ error: "Project not found" }, 404);
	}

	const { results: timesheets } = await db
		.prepare(
			`SELECT id, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE projectId = ? AND userId = ? ORDER BY createdAt DESC`,
		)
		.bind(projectId, userId)
		.all();

	return c.json({
		...project,
		active: !!project.active,
		timesheets: timesheets.map((t: Record<string, unknown>) => ({
			...t,
			active: !!t.active,
		})),
	});
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
	const userId = c.get("userId");

	const insertResult = await db
		.prepare(
			`INSERT INTO projects (name, customerId, rate_in_cents, description, userId)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(
			body.name,
			body.customerId,
			body.rate_in_cents,
			body.description,
			userId,
		)
		.run();
	const createdProjectId = insertResult.meta.last_row_id;

	if (!createdProjectId) {
		return c.json({ error: "Failed to create project" }, 500);
	}

	const project = await db
		.prepare(
			`SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		)
		.bind(createdProjectId, userId)
		.first();

	const projectRow = { ...project, active: !!project!.active };

	const createTimesheet = c.req.query("createTimesheet") === "true";

	if (!createTimesheet) {
		return c.json({ project: projectRow, timesheet: null }, 201);
	}

	const timesheetName = `${new Date().toLocaleDateString()} Timesheet`;
	const tsResult = await db
		.prepare(
			`INSERT INTO timesheets (projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(createdProjectId, timesheetName, "Initial timesheet", 1, userId)
		.run();

	if (!tsResult.meta.last_row_id) {
		return c.json({ project: projectRow, timesheet: null }, 201);
	}

	const tsRow = await db
		.prepare(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(tsResult.meta.last_row_id, userId)
		.first();

	return c.json(
		{ project: projectRow, timesheet: { ...tsRow, active: !!tsRow!.active } },
		201,
	);
});

// PUT /api/projects/:id - update project
app.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<Project>();
	const db = getDb(c.env);
	const userId = c.get("userId");
	const rate = body.rate_in_cents ?? 0;

	if (!body.name || !body.customerId || rate < 0) {
		return c.json({ error: "Invalid project data" }, 400);
	}

	await db
		.prepare(
			`UPDATE projects
			SET name = ?, customerId = ?, rate_in_cents = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		)
		.bind(
			body.name,
			body.customerId,
			rate * 100,
			body.description ?? "",
			body.active ? 1 : 0,
			id,
			userId,
		)
		.run();

	const updated = await db
		.prepare(
			`SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first();

	if (!updated) {
		return c.json({ error: "Project not found" }, 404);
	}

	return c.json({ ...updated, active: !!updated.active });
});

// DELETE /api/projects/:id
app.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM projects WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as projectRoutes };
