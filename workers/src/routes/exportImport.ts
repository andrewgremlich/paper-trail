import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env, ExportData } from "../lib/types";
import { getCurrentUserId } from "../lib/userId";

const app = new Hono<{ Bindings: Env }>();

// GET /api/export/data - export all data as JSON
app.get("/data", async (c) => {
	const db = getDb(c.env);
	const userId = await getCurrentUserId(db);

	const [
		projects,
		timesheets,
		timesheetEntries,
		transactions,
		userProfileRows,
	] = await Promise.all([
		db.execute({
			sql: `SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
					FROM projects WHERE userId = ? ORDER BY id ASC`,
			args: [userId],
		}),
		db.execute({
			sql: `SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
					FROM timesheets WHERE userId = ? ORDER BY id ASC`,
			args: [userId],
		}),
		db.execute({
			sql: `SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
					FROM timesheet_entries WHERE userId = ? ORDER BY id ASC`,
			args: [userId],
		}),
		db.execute({
			sql: `SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
					FROM transactions WHERE userId = ? ORDER BY id ASC`,
			args: [userId],
		}),
		db.execute(
			"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
		),
	]);

	const data: ExportData = {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		projects: projects.rows as unknown as ExportData["projects"],
		timesheets: timesheets.rows as unknown as ExportData["timesheets"],
		timesheetEntries:
			timesheetEntries.rows as unknown as ExportData["timesheetEntries"],
		transactions: transactions.rows as unknown as ExportData["transactions"],
		userProfile: userProfileRows
			.rows[0] as unknown as ExportData["userProfile"],
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
	const userId = await getCurrentUserId(db);

	// Delete existing data in reverse dependency order
	await db.execute({
		sql: "DELETE FROM timesheet_entries WHERE userId = ?",
		args: [userId],
	});
	await db.execute({
		sql: "DELETE FROM transactions WHERE userId = ?",
		args: [userId],
	});
	await db.execute({
		sql: "DELETE FROM timesheets WHERE userId = ?",
		args: [userId],
	});
	await db.execute({
		sql: "DELETE FROM projects WHERE userId = ?",
		args: [userId],
	});

	// Insert projects
	for (const project of data.projects) {
		await db.execute({
			sql: `INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				project.id,
				project.name,
				project.active ? 1 : 0,
				project.customerId,
				project.rate_in_cents,
				project.description,
				project.createdAt,
				project.updatedAt,
				userId,
			],
		});
	}

	// Insert timesheets
	for (const ts of data.timesheets) {
		await db.execute({
			sql: `INSERT INTO timesheets (id, projectId, invoiceId, name, description, active, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				ts.id,
				ts.projectId,
				ts.invoiceId,
				ts.name,
				ts.description,
				ts.active ? 1 : 0,
				ts.createdAt,
				ts.updatedAt,
				userId,
			],
		});
	}

	// Insert timesheet entries
	for (const entry of data.timesheetEntries) {
		await db.execute({
			sql: `INSERT INTO timesheet_entries (id, timesheetId, date, minutes, description, amount, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				entry.id,
				entry.timesheetId,
				entry.date,
				entry.minutes,
				entry.description,
				entry.amount,
				entry.createdAt,
				entry.updatedAt,
				userId,
			],
		});
	}

	// Insert transactions
	for (const tx of data.transactions) {
		await db.execute({
			sql: `INSERT INTO transactions (id, projectId, date, description, amount, filePath, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				tx.id,
				tx.projectId,
				tx.date,
				tx.description,
				tx.amount,
				tx.filePath,
				tx.createdAt,
				tx.updatedAt,
				userId,
			],
		});
	}

	// Update user profile if present
	if (data.userProfile) {
		const existing = await db.execute("SELECT id FROM user_profile LIMIT 1");
		if (existing.rows.length > 0) {
			await db.execute({
				sql: "UPDATE user_profile SET displayName = ?, email = ? WHERE id = ?",
				args: [
					data.userProfile.displayName,
					data.userProfile.email,
					existing.rows[0].id,
				],
			});
		}
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
	const userId = await getCurrentUserId(db);
	const projectId = c.req.query("projectId");
	const projectName = c.req.query("projectName") ?? "unknown";
	const format = c.req.query("format") ?? "csv";

	const result = await db.execute({
		sql: `SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
			FROM transactions WHERE projectId = ? AND userId = ? ORDER BY date ASC, createdAt ASC`,
		args: [Number(projectId), userId],
	});

	const transactions = result.rows.map((r) => ({
		...r,
		amount: (r.amount as number) / 100,
	}));

	if (format === "json") {
		const data = {
			project: projectName,
			exportedAt: new Date().toISOString(),
			transactions: transactions.map((tx) => ({
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
	const rows = transactions.map((tx) =>
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
