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
	const invoiceId = row.invoiceId
		? await decrypt(row.invoiceId as string, env)
		: row.invoiceId;

	return { ...row, description, invoiceId };
}

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
	const rows = await Promise.all(
		results.map(async (r: Record<string, unknown>) => ({
			...(await decryptTimesheetRow(r, c.env)),
			active: !!r.active,
		})),
	);
	return c.json(rows);
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

	const decryptedHeader = await decryptTimesheetRow(
		header as Record<string, unknown>,
		c.env,
	);

	// Decrypt joined project fields
	const customerId = decryptedHeader.customerId
		? await decrypt(decryptedHeader.customerId as string, c.env)
		: decryptedHeader.customerId;
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
		customerId,
		projectRate,
		active: !!header.active,
		entries,
	});
});

// GET /api/timesheets/by-invoice/:invoiceId
app.get("/by-invoice/:invoiceId", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const invoiceId = c.req.param("invoiceId");

	// invoiceId is encrypted with random IV, so we must scan and decrypt to match
	const { results } = await db
		.prepare(
			`SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
			p.customerId as customerId, p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.invoiceId IS NOT NULL AND t.userId = ?`,
		)
		.bind(userId)
		.all();

	let matched: Record<string, unknown> | null = null;
	for (const row of results) {
		const decryptedInvoiceId = await decrypt(
			(row as Record<string, unknown>).invoiceId as string,
			c.env,
		);
		if (decryptedInvoiceId === invoiceId) {
			matched = row as Record<string, unknown>;
			break;
		}
	}

	if (!matched) {
		return c.json(null);
	}

	const decryptedResult = await decryptTimesheetRow(matched, c.env);

	// Decrypt joined project fields
	const customerId = decryptedResult.customerId
		? await decrypt(decryptedResult.customerId as string, c.env)
		: decryptedResult.customerId;
	const projectRate = isEncryptionEnabled(c.env)
		? Number(await decrypt(decryptedResult.projectRate as string, c.env))
		: (decryptedResult.projectRate as number);

	return c.json({
		...decryptedResult,
		customerId,
		projectRate,
		active: !!matched.active,
	});
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
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
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
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
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

// DELETE /api/timesheets/:id
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
