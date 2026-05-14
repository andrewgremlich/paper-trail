import { Hono } from "hono";
import { z } from "zod";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import {
	descriptionSchema,
	positiveMoneyCentsSchema,
	shortNameSchema,
	userOwnsCustomer,
	uuidSchema,
} from "../lib/validators";
import type { AuthVariables } from "../middleware/auth";

const projectCreateSchema = z.object({
	name: shortNameSchema,
	customerId: uuidSchema.nullable().optional(),
	rate_in_cents: positiveMoneyCentsSchema,
	description: descriptionSchema.default(""),
});

const projectUpdateSchema = projectCreateSchema.extend({
	active: z.boolean(),
});

async function decryptProjectRow(
	row: Record<string, unknown>,
	env: Env,
): Promise<Record<string, unknown>> {
	const description = await decrypt((row.description as string) ?? "", env);
	const rate_in_cents = isEncryptionEnabled(env)
		? Number(await decrypt(row.rate_in_cents as string, env))
		: Number(row.rate_in_cents ?? 0);

	return { ...row, description, rate_in_cents };
}

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/v1/projects - list all projects
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
	const rows = await Promise.all(
		results.map(async (r: Record<string, unknown>) => ({
			...(await decryptProjectRow(r, c.env)),
			active: !!r.active,
		})),
	);
	return c.json(rows);
});

// GET /api/v1/projects/:id - get project with timesheets
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const projectId = c.req.param("id");

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

	const decryptedProject = await decryptProjectRow(
		project as Record<string, unknown>,
		c.env,
	);

	const { results: timesheets } = await db
		.prepare(
			`SELECT id, name, description, closed, createdAt, updatedAt
			FROM timesheets WHERE projectId = ? AND userId = ? ORDER BY createdAt DESC`,
		)
		.bind(projectId, userId)
		.all();

	return c.json({
		...decryptedProject,
		active: !!project.active,
		timesheets: await Promise.all(
			timesheets.map(async (t: Record<string, unknown>) => ({
				...t,
				description: t.description
					? await decrypt(t.description as string, c.env)
					: t.description,
				closed: !!t.closed,
			})),
		),
	});
});

// POST /api/v1/projects - create project, optionally with initial timesheet
app.post("/", async (c) => {
	const parsed = projectCreateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid project", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	if (body.customerId && !(await userOwnsCustomer(c.env, body.customerId, userId))) {
		return c.json({ error: "Customer not found" }, 404);
	}

	const encRate = await encrypt(String(body.rate_in_cents), c.env);
	const encDescription = await encrypt(body.description, c.env);
	const projectId = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO projects (id, name, customerId, rate_in_cents, description, userId)
			VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			projectId,
			body.name,
			body.customerId ?? null,
			encRate,
			encDescription,
			userId,
		)
		.run();

	const project = await db
		.prepare(
			`SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = ? AND userId = ?`,
		)
		.bind(projectId, userId)
		.first();

	if (!project) {
		return c.json({ error: "Failed to read back created project" }, 500);
	}

	const decrypted = await decryptProjectRow(
		project as Record<string, unknown>,
		c.env,
	);
	const projectRow = { ...decrypted, active: !!project.active };

	const createTimesheet = c.req.query("createTimesheet") === "true";

	if (!createTimesheet) {
		return c.json({ project: projectRow, timesheet: null }, 201);
	}

	const timesheetName = `${new Date().toLocaleDateString()} Timesheet`;
	const timesheetId = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO timesheets (id, projectId, name, description, closed, userId)
			VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			timesheetId,
			projectId,
			timesheetName,
			await encrypt("Initial timesheet", c.env),
			0,
			userId,
		)
		.run();

	const tsRow = await db
		.prepare(
			`SELECT id, userId, projectId, name, description, closed, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(timesheetId, userId)
		.first();

	if (!tsRow) {
		return c.json({ project: projectRow, timesheet: null }, 201);
	}

	return c.json(
		{
			project: projectRow,
			timesheet: {
				...tsRow,
				description: tsRow.description
					? await decrypt(tsRow.description as string, c.env)
					: tsRow.description,
				closed: !!tsRow.closed,
			},
		},
		201,
	);
});

// PUT /api/v1/projects/:id - update project
app.put("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = projectUpdateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid project", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	if (body.customerId && !(await userOwnsCustomer(c.env, body.customerId, userId))) {
		return c.json({ error: "Customer not found" }, 404);
	}

	const encRate = await encrypt(String(body.rate_in_cents), c.env);
	const encDescription = await encrypt(body.description, c.env);

	await db
		.prepare(
			`UPDATE projects
			SET name = ?, customerId = ?, rate_in_cents = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		)
		.bind(
			body.name,
			body.customerId ?? null,
			encRate,
			encDescription,
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

	const decryptedUpdated = await decryptProjectRow(
		updated as Record<string, unknown>,
		c.env,
	);
	return c.json({ ...decryptedUpdated, active: !!updated.active });
});

// DELETE /api/v1/projects/:id
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM projects WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as projectRoutes };
