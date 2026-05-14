import { Hono } from "hono";
import { z } from "zod";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import {
	descriptionSchema,
	shortNameSchema,
	userOwnsProject,
	uuidSchema,
} from "../lib/validators";
import type { AuthVariables } from "../middleware/auth";

const timesheetCreateSchema = z.object({
	projectId: uuidSchema,
	name: shortNameSchema,
	description: descriptionSchema.nullable().optional(),
});

const timesheetUpdateSchema = z.object({
	name: shortNameSchema,
	description: descriptionSchema.nullable().optional(),
	active: z.boolean(),
});

async function decryptTimesheetRow(
	row: Record<string, unknown>,
	env: Env,
): Promise<Record<string, unknown>> {
	const description = row.description
		? await decrypt(row.description as string, env)
		: row.description;

	return { ...row, description };
}

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/v1/timesheets - list all timesheets
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const { results } = await db
		.prepare(
			`SELECT id, userId, projectId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE userId = ? ORDER BY createdAt DESC`,
		)
		.bind(userId)
		.all();
	const rows = await Promise.all(
		results.map(async (r: Record<string, unknown>) => ({
			...(await decryptTimesheetRow(r, c.env)),
			active: !!r.active,
		})),
	);
	return c.json(rows);
});

// GET /api/v1/timesheets/by-invoice/:invoiceId — look up the timesheet that an
// invoice was generated from. invoiceId is the invoices.id (a UUID).
app.get("/by-invoice/:invoiceId", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const invoiceId = c.req.param("invoiceId");

	const invoiceLookup = await db
		.prepare("SELECT timesheetId FROM invoices WHERE id = ? AND userId = ?")
		.bind(invoiceId, userId)
		.first<{ timesheetId: string | null }>();

	if (!invoiceLookup?.timesheetId) {
		return c.json(null);
	}

	const row = await db
		.prepare(
			`SELECT t.id, t.userId, t.projectId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			        p.customerId AS customerId, p.rate_in_cents AS projectRate
			 FROM timesheets t
			 JOIN projects p ON p.id = t.projectId
			 WHERE t.id = ? AND t.userId = ?`,
		)
		.bind(invoiceLookup.timesheetId, userId)
		.first();

	if (!row) return c.json(null);

	const decrypted = await decryptTimesheetRow(
		row as Record<string, unknown>,
		c.env,
	);
	const projectRate = isEncryptionEnabled(c.env)
		? Number(await decrypt(decrypted.projectRate as string, c.env))
		: Number(decrypted.projectRate ?? 0);

	return c.json({
		...decrypted,
		projectRate,
		active: !!(row as Record<string, unknown>).active,
	});
});

// GET /api/v1/timesheets/:id - get timesheet with entries
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const timesheetId = c.req.param("id");

	const header = await db
		.prepare(
			`SELECT t.id, t.userId, t.projectId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
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

	const decryptedHeader = await decryptTimesheetRow(
		header as Record<string, unknown>,
		c.env,
	);

	// customerId is a plain TEXT FK — no decrypt.
	const projectRate = isEncryptionEnabled(c.env)
		? Number(await decrypt(decryptedHeader.projectRate as string, c.env))
		: Number(decryptedHeader.projectRate ?? 0);

	const { results: entriesRows } = await db
		.prepare(
			`SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
			FROM timesheet_entries WHERE timesheetId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
		)
		.bind(timesheetId, userId)
		.all();

	// Decrypt entries and convert amount from integer cents to dollars for UI
	const entries = await Promise.all(
		entriesRows.map(async (e: Record<string, unknown>) => {
			const description = await decrypt(e.description as string, c.env);
			const amount = isEncryptionEnabled(c.env)
				? Number(await decrypt(e.amount as string, c.env))
				: Number(e.amount ?? 0);
			return { ...e, description, amount: amount / 100 };
		}),
	);

	return c.json({
		...decryptedHeader,
		projectRate,
		active: !!header.active,
		entries,
	});
});

// POST /api/v1/timesheets - create timesheet
app.post("/", async (c) => {
	const parsed = timesheetCreateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid timesheet", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	if (!(await userOwnsProject(c.env, body.projectId, userId))) {
		return c.json({ error: "Project not found" }, 404);
	}

	const encDescription = body.description
		? await encrypt(body.description, c.env)
		: null;
	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO timesheets (id, projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, body.projectId, body.name, encDescription, 1, userId)
		.run();

	const row = await db
		.prepare(
			`SELECT id, userId, projectId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first();

	if (!row) {
		return c.json({ error: "Failed to read back created timesheet" }, 500);
	}

	const decryptedRow = await decryptTimesheetRow(
		row as Record<string, unknown>,
		c.env,
	);
	return c.json({ ...decryptedRow, active: !!row.active }, 201);
});

// PUT /api/v1/timesheets/:id - update timesheet
app.put("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = timesheetUpdateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid timesheet", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	const encDescription = body.description
		? await encrypt(body.description, c.env)
		: null;

	await db
		.prepare(
			`UPDATE timesheets
			SET name = ?, description = ?, active = ?, updatedAt = datetime('now')
			WHERE id = ? AND userId = ?`,
		)
		.bind(body.name, encDescription, body.active ? 1 : 0, id, userId)
		.run();

	const updated = await db
		.prepare(
			`SELECT id, userId, projectId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first();

	if (!updated) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	const decryptedUpdated = await decryptTimesheetRow(
		updated as Record<string, unknown>,
		c.env,
	);
	return c.json({ ...decryptedUpdated, active: !!updated.active });
});

// DELETE /api/v1/timesheets/:id
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM timesheets WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as timesheetRoutes };
