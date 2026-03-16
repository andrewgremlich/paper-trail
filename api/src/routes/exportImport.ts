import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env, ExportData } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/export/data - export all data as JSON
app.get("/data", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const [projects, timesheets, timesheetEntries, transactions, userProfile] =
		await Promise.all([
			db
				.prepare(
					`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
					FROM projects WHERE userId = ? ORDER BY id ASC`,
				)
				.bind(userId)
				.all(),
			db
				.prepare(
					`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
					FROM timesheets WHERE userId = ? ORDER BY id ASC`,
				)
				.bind(userId)
				.all(),
			db
				.prepare(
					`SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
					FROM timesheet_entries WHERE userId = ? ORDER BY id ASC`,
				)
				.bind(userId)
				.all(),
			db
				.prepare(
					`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
					FROM transactions WHERE userId = ? ORDER BY id ASC`,
				)
				.bind(userId)
				.all(),
			db
				.prepare(
					"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM users WHERE id = ?",
				)
				.bind(userId)
				.first(),
		]);

	const data: ExportData = {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		projects: projects.results as unknown as ExportData["projects"],
		timesheets: timesheets.results as unknown as ExportData["timesheets"],
		timesheetEntries:
			timesheetEntries.results as unknown as ExportData["timesheetEntries"],
		transactions: transactions.results as unknown as ExportData["transactions"],
		userProfile: userProfile as unknown as ExportData["userProfile"],
	};

	return c.json(data);
});

// POST /api/import/data - import JSON data (replaces existing)
app.post("/data", async (c) => {
	const data = await c.req.json<ExportData>();

	// Validate structure
	if (
		!data.version ||
		!data.exportDate ||
		!Array.isArray(data.projects) ||
		!Array.isArray(data.timesheets) ||
		!Array.isArray(data.timesheetEntries) ||
		!Array.isArray(data.transactions)
	) {
		return c.json({ error: "Invalid backup file format" }, 400);
	}

	const db = getDb(c.env);
	const userId = c.get("userId");

	// Delete existing data in reverse dependency order
	await db
		.prepare("DELETE FROM timesheet_entries WHERE userId = ?")
		.bind(userId)
		.run();
	await db
		.prepare("DELETE FROM transactions WHERE userId = ?")
		.bind(userId)
		.run();
	await db
		.prepare("DELETE FROM timesheets WHERE userId = ?")
		.bind(userId)
		.run();
	await db.prepare("DELETE FROM projects WHERE userId = ?").bind(userId).run();

	// Insert projects
	for (const project of data.projects) {
		await db
			.prepare(
				`INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				project.id,
				project.name,
				project.active ? 1 : 0,
				project.customerId,
				project.rate_in_cents,
				project.description,
				project.createdAt,
				project.updatedAt,
				userId,
			)
			.run();
	}

	// Insert timesheets
	for (const ts of data.timesheets) {
		await db
			.prepare(
				`INSERT INTO timesheets (id, projectId, invoiceId, name, description, active, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				ts.id,
				ts.projectId,
				ts.invoiceId,
				ts.name,
				ts.description,
				ts.active ? 1 : 0,
				ts.createdAt,
				ts.updatedAt,
				userId,
			)
			.run();
	}

	// Insert timesheet entries
	for (const entry of data.timesheetEntries) {
		await db
			.prepare(
				`INSERT INTO timesheet_entries (id, timesheetId, date, minutes, description, amount, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				entry.id,
				entry.timesheetId,
				entry.date,
				entry.minutes,
				entry.description,
				entry.amount,
				entry.createdAt,
				entry.updatedAt,
				userId,
			)
			.run();
	}

	// Insert transactions
	for (const tx of data.transactions) {
		await db
			.prepare(
				`INSERT INTO transactions (id, projectId, date, description, amount, filePath, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				tx.id,
				tx.projectId,
				tx.date,
				tx.description,
				tx.amount,
				tx.filePath,
				tx.createdAt,
				tx.updatedAt,
				userId,
			)
			.run();
	}

	// Update user profile if present
	if (data.userProfile) {
		await db
			.prepare("UPDATE users SET displayName = ?, email = ? WHERE id = ?")
			.bind(data.userProfile.displayName, data.userProfile.email, userId)
			.run();
	}

	return c.json({
		projectsCount: data.projects.length,
		timesheetsCount: data.timesheets.length,
		entriesCount: data.timesheetEntries.length,
		transactionsCount: data.transactions.length,
	});
});

// GET /api/export/transactions?projectId=X&projectName=Y&format=csv|json
app.get("/transactions", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const projectId = c.req.query("projectId");
	const projectName = c.req.query("projectName") ?? "unknown";
	const format = c.req.query("format") ?? "csv";

	const { results } = await db
		.prepare(
			`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
			FROM transactions WHERE projectId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
		)
		.bind(Number(projectId), userId)
		.all();

	const transactions = results.map((r: Record<string, unknown>) => ({
		...r,
		amount: (r.amount as number) / 100,
	}));

	if (format === "json") {
		const data = {
			project: projectName,
			exportedAt: new Date().toISOString(),
			transactions: transactions.map((tx: Record<string, unknown>) => ({
				date: tx.date,
				description: tx.description,
				amount: tx.amount,
			})),
		};
		return c.json(data);
	}

	// CSV format
	const escaped = (val: string) =>
		val.includes(",") || val.includes('"') || val.includes("\n")
			? `"${val.replace(/"/g, '""')}"`
			: val;

	const header = "Date,Project,Description,Amount";
	const rows = transactions.map((tx: Record<string, unknown>) =>
		[
			escaped(tx.date as string),
			escaped(projectName),
			escaped(tx.description as string),
			(tx.amount as number).toFixed(2),
		].join(","),
	);
	const csv = [header, ...rows].join("\n");

	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="transactions-${projectName}-${new Date().toISOString().split("T")[0]}.csv"`,
		},
	});
});

export { app as exportImportRoutes };
