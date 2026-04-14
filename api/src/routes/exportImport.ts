import { zipSync } from "fflate";
import { Hono } from "hono";
import { decrypt, decryptBuffer, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env, ExportData } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

async function decryptTransactionRow(
	row: Record<string, unknown>,
	env: Env,
): Promise<Record<string, unknown>> {
	const description = await decrypt(row.description as string, env);
	const amount = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount as string, env))
		: (row.amount as number);

	return { ...row, description, amount };
}

// GET /api/export/data?encrypted=true|false - export all data as JSON
app.get("/data", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const wantEncrypted = c.req.query("encrypted") === "true";

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

	let transactionResults = transactions.results as Record<string, unknown>[];
	let projectResults = projects.results as Record<string, unknown>[];
	let timesheetResults = timesheets.results as Record<string, unknown>[];
	let entryResults = timesheetEntries.results as Record<string, unknown>[];

	if (!wantEncrypted && isEncryptionEnabled(c.env)) {
		transactionResults = await Promise.all(
			transactionResults.map((r) => decryptTransactionRow(r, c.env)),
		);
		projectResults = await Promise.all(
			projectResults.map(async (r) => ({
				...r,
				customerId: await decrypt(r.customerId as string, c.env),
				description: await decrypt((r.description as string) ?? "", c.env),
				rate_in_cents: Number(
					await decrypt(r.rate_in_cents as string, c.env),
				),
			})),
		);
		timesheetResults = await Promise.all(
			timesheetResults.map(async (r) => ({
				...r,
				description: r.description
					? await decrypt(r.description as string, c.env)
					: r.description,
				invoiceId: r.invoiceId
					? await decrypt(r.invoiceId as string, c.env)
					: r.invoiceId,
			})),
		);
		entryResults = await Promise.all(
			entryResults.map(async (r) => ({
				...r,
				description: await decrypt(r.description as string, c.env),
				amount: Number(await decrypt(r.amount as string, c.env)),
			})),
		);
	}

	const data: ExportData = {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		encrypted: wantEncrypted && isEncryptionEnabled(c.env),
		projects: projectResults as unknown as ExportData["projects"],
		timesheets: timesheetResults as unknown as ExportData["timesheets"],
		timesheetEntries:
			entryResults as unknown as ExportData["timesheetEntries"],
		transactions: transactionResults as unknown as ExportData["transactions"],
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

	// Determine if imported data is already encrypted
	const isDataEncrypted = data.encrypted === true;

	// Insert projects — encrypt if data is plaintext, store as-is if already encrypted
	for (const project of data.projects) {
		const customerId = isDataEncrypted
			? project.customerId
			: await encrypt(project.customerId ?? "", c.env);
		const rate_in_cents = isDataEncrypted
			? project.rate_in_cents
			: await encrypt(String(project.rate_in_cents), c.env);
		const description = isDataEncrypted
			? project.description
			: await encrypt(project.description ?? "", c.env);

		await db
			.prepare(
				`INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				project.id,
				project.name,
				project.active ? 1 : 0,
				customerId,
				rate_in_cents,
				description,
				project.createdAt,
				project.updatedAt,
				userId,
			)
			.run();
	}

	// Insert timesheets — encrypt if data is plaintext
	for (const ts of data.timesheets) {
		const description = isDataEncrypted
			? ts.description
			: ts.description
				? await encrypt(ts.description, c.env)
				: null;
		const invoiceId = isDataEncrypted
			? ts.invoiceId
			: ts.invoiceId
				? await encrypt(ts.invoiceId, c.env)
				: null;

		await db
			.prepare(
				`INSERT INTO timesheets (id, projectId, invoiceId, name, description, active, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				ts.id,
				ts.projectId,
				invoiceId,
				ts.name,
				description,
				ts.active ? 1 : 0,
				ts.createdAt,
				ts.updatedAt,
				userId,
			)
			.run();
	}

	// Insert timesheet entries — encrypt if data is plaintext
	for (const entry of data.timesheetEntries) {
		const description = isDataEncrypted
			? entry.description
			: await encrypt(entry.description, c.env);
		const amount = isDataEncrypted
			? entry.amount
			: await encrypt(String(entry.amount), c.env);

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
				description,
				amount,
				entry.createdAt,
				entry.updatedAt,
				userId,
			)
			.run();
	}

	// Insert transactions — encrypt if data is plaintext, store as-is if already encrypted
	for (const tx of data.transactions) {
		let description: string;
		let amount: string | number;

		if (isDataEncrypted) {
			// Already encrypted with the same key — store as-is
			description = tx.description;
			amount = tx.amount;
		} else {
			// Plaintext import — encrypt before storing
			description = await encrypt(tx.description, c.env);
			amount = await encrypt(String(tx.amount), c.env);
		}

		await db
			.prepare(
				`INSERT INTO transactions (id, projectId, date, description, amount, filePath, createdAt, updatedAt, userId)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				tx.id,
				tx.projectId,
				tx.date,
				description,
				amount,
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

	const transactions = await Promise.all(
		results.map(async (r: Record<string, unknown>) => {
			const description = await decrypt(r.description as string, c.env);
			const rawAmount = isEncryptionEnabled(c.env)
				? Number(await decrypt(r.amount as string, c.env))
				: (r.amount as number);

			return { ...r, description, amount: rawAmount / 100 };
		}),
	);

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

// GET /api/export/zip - export all data + R2 files as a ZIP archive
app.get("/zip", async (c) => {
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

	let transactionResults = transactions.results as Record<string, unknown>[];
	let projectResults = projects.results as Record<string, unknown>[];
	let timesheetResults = timesheets.results as Record<string, unknown>[];
	let entryResults = timesheetEntries.results as Record<string, unknown>[];

	if (isEncryptionEnabled(c.env)) {
		transactionResults = await Promise.all(
			transactionResults.map((r) => decryptTransactionRow(r, c.env)),
		);
		projectResults = await Promise.all(
			projectResults.map(async (r) => ({
				...r,
				customerId: await decrypt(r.customerId as string, c.env),
				description: await decrypt((r.description as string) ?? "", c.env),
				rate_in_cents: Number(await decrypt(r.rate_in_cents as string, c.env)),
			})),
		);
		timesheetResults = await Promise.all(
			timesheetResults.map(async (r) => ({
				...r,
				description: r.description
					? await decrypt(r.description as string, c.env)
					: r.description,
				invoiceId: r.invoiceId
					? await decrypt(r.invoiceId as string, c.env)
					: r.invoiceId,
			})),
		);
		entryResults = await Promise.all(
			entryResults.map(async (r) => ({
				...r,
				description: await decrypt(r.description as string, c.env),
				amount: Number(await decrypt(r.amount as string, c.env)),
			})),
		);
	}

	const data: ExportData = {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		encrypted: false,
		projects: projectResults as unknown as ExportData["projects"],
		timesheets: timesheetResults as unknown as ExportData["timesheets"],
		timesheetEntries: entryResults as unknown as ExportData["timesheetEntries"],
		transactions: transactionResults as unknown as ExportData["transactions"],
		userProfile: userProfile as unknown as ExportData["userProfile"],
	};

	const zipEntries: Record<string, Uint8Array> = {
		"data.json": new TextEncoder().encode(JSON.stringify(data, null, 2)),
	};

	// Fetch and include all R2 files referenced by transactions
	const filePaths = transactionResults
		.map((tx) => tx.filePath as string | null | undefined)
		.filter((p): p is string => !!p && !/^https?:\/\//i.test(p));

	await Promise.all(
		filePaths.map(async (key) => {
			const object = await c.env.FILES_BUCKET.get(key);
			if (!object) return;

			const encryptedBytes = await object.arrayBuffer();
			const decrypted = await decryptBuffer(encryptedBytes, c.env);
			zipEntries[`files/${key}`] = new Uint8Array(decrypted);
		}),
	);

	const zipped = zipSync(zipEntries, { level: 6 });

	const dateStr = new Date().toISOString().split("T")[0];
	return new Response(zipped, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="paper-trail-backup-${dateStr}.zip"`,
		},
	});
});

export { app as exportImportRoutes };
