import { Hono } from "hono";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

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
// invoice was generated from. `invoiceId` here is the invoices.id (or uuid).
app.get("/by-invoice/:invoiceId", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const invoiceParam = c.req.param("invoiceId");
	const numericId = Number(invoiceParam);

	const invoiceLookup = Number.isFinite(numericId)
		? await db
				.prepare(
					"SELECT timesheetId FROM invoices WHERE id = ? AND userId = ?",
				)
				.bind(numericId, userId)
				.first<{ timesheetId: number | null }>()
		: await db
				.prepare(
					"SELECT timesheetId FROM invoices WHERE uuid = ? AND userId = ?",
				)
				.bind(invoiceParam, userId)
				.first<{ timesheetId: number | null }>();

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
		: (decrypted.projectRate as number);

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
	const timesheetId = Number(c.req.param("id"));

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

	// customerId is now a plain INTEGER FK — no decrypt.
	const projectRate = isEncryptionEnabled(c.env)
		? Number(await decrypt(decryptedHeader.projectRate as string, c.env))
		: (decryptedHeader.projectRate as number);

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
				: (e.amount as number);
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
	const body = await c.req.json<{
		projectId: number;
		name: string;
		description?: string;
	}>();
	const db = getDb(c.env);
	const userId = c.get("userId");

	const encDescription = body.description
		? await encrypt(body.description, c.env)
		: null;

	const insertResult = await db
		.prepare(
			`INSERT INTO timesheets (projectId, name, description, active, userId)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(body.projectId, body.name, encDescription, 1, userId)
		.run();

	const row = await db
		.prepare(
			`SELECT id, userId, projectId, name, description, active, createdAt, updatedAt
			FROM timesheets WHERE id = ? AND userId = ?`,
		)
		.bind(insertResult.meta.last_row_id, userId)
		.first();

	const decryptedRow = await decryptTimesheetRow(
		row as Record<string, unknown>,
		c.env,
	);
	return c.json({ ...decryptedRow, active: !!row!.active }, 201);
});

// PUT /api/v1/timesheets/:id - update timesheet
app.put("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{
		name: string;
		description?: string;
		active: boolean;
	}>();
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
	const id = Number(c.req.param("id"));
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM timesheets WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as timesheetRoutes };
