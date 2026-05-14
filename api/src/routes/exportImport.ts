import { unzipSync, zipSync } from "fflate";
import { Hono } from "hono";
import { z } from "zod";
import { decrypt, decryptBuffer, encrypt, encryptBuffer, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env, ExportData } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ─── Validation schemas ───────────────────────────────────────────────────────
//
// Encrypted exports keep numeric columns as base64 ciphertext strings, while
// plaintext exports keep them as numbers. The schemas below accept either form
// — type-checking the row values is the goal, not coercing them. The batch
// builder chooses whether to encrypt each value based on `data.encrypted`.

const stringOrNullish = z.union([z.string(), z.null()]).optional();
const numericOrEncrypted = z.union([z.string(), z.number()]);
const boolOrNumber = z.union([z.boolean(), z.number()]).optional();

const customerImportSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	email: z.string(),
	address: stringOrNullish,
	consentToEmailInvoices: boolOrNumber,
	consentedAt: stringOrNullish,
	consentRequestedAt: stringOrNullish,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const projectImportSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	active: boolOrNumber,
	customerId: stringOrNullish,
	rate_in_cents: numericOrEncrypted,
	description: stringOrNullish,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const timesheetImportSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	name: z.string(),
	description: stringOrNullish,
	active: boolOrNumber,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const timesheetEntryImportSchema = z.object({
	id: z.string().min(1),
	timesheetId: z.string().min(1),
	date: z.string(),
	minutes: z.number().int().nonnegative(),
	description: z.string(),
	amount: numericOrEncrypted,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const transactionImportSchema = z.object({
	id: z.string().min(1),
	projectId: z.string().min(1),
	date: z.string(),
	description: z.string(),
	amount: numericOrEncrypted,
	filePath: stringOrNullish,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const invoiceImportSchema = z.object({
	id: z.string().min(1),
	customerId: z.string().min(1),
	timesheetId: stringOrNullish,
	number: z.string(),
	status: z.enum(["draft", "sent", "paid", "void"]),
	amount_cents: numericOrEncrypted,
	description: stringOrNullish,
	issuedAt: z.string(),
	dueDate: z.string(),
	sentAt: stringOrNullish,
	paidAt: stringOrNullish,
	voidedAt: stringOrNullish,
	archivedAt: stringOrNullish,
	createdAt: z.string(),
	updatedAt: z.string(),
});

const userProfileImportSchema = z
	.object({
		displayName: z.string().nullish(),
		email: z.string().nullish(),
		venmoHandle: stringOrNullish,
		paypalHandle: stringOrNullish,
		businessName: stringOrNullish,
		businessAddress: stringOrNullish,
	})
	.partial();

const exportDataSchema = z.object({
	version: z.string(),
	exportDate: z.string(),
	encrypted: z.boolean().optional(),
	customers: z.array(customerImportSchema).optional(),
	projects: z.array(projectImportSchema),
	timesheets: z.array(timesheetImportSchema),
	timesheetEntries: z.array(timesheetEntryImportSchema),
	transactions: z.array(transactionImportSchema),
	invoices: z.array(invoiceImportSchema).optional(),
	userProfile: userProfileImportSchema.nullish(),
});

type ValidatedImport = z.infer<typeof exportDataSchema>;

function contentTypeToExtension(contentType: string): string {
	const type = contentType.split(";")[0].trim().toLowerCase();
	const map: Record<string, string> = {
		"image/jpeg": ".jpg",
		"image/jpg": ".jpg",
		"image/png": ".png",
		"image/gif": ".gif",
		"image/webp": ".webp",
		"image/svg+xml": ".svg",
		"application/pdf": ".pdf",
		"text/plain": ".txt",
		"text/csv": ".csv",
		"application/msword": ".doc",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
		"application/vnd.ms-excel": ".xls",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
	};
	return map[type] ?? "";
}

function sanitizeFilename(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_\-. ]/g, "")
		.trim()
		.replace(/\s+/g, "_")
		.slice(0, 64) || "file";
}

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

// ─── Atomic-import batch builder ──────────────────────────────────────────────
//
// Encryption can't run inside a `db.batch()` because the bind() args are
// captured eagerly. We resolve every encrypted value first, then build the
// statement list, then hand the whole list to D1 in a single transactional
// batch — any failure rolls the entire import back, leaving the previous data
// intact (§15).

async function buildImportBatch(
	db: D1Database,
	data: ValidatedImport,
	userId: number,
	env: Env,
): Promise<D1PreparedStatement[]> {
	const isDataEncrypted = data.encrypted === true;
	const enc = (v: string) => (isDataEncrypted ? v : encrypt(v, env));
	const encOrNull = async (v: string | null | undefined): Promise<string | null> =>
		v == null ? null : await enc(v);

	// Pre-encrypt all the values we'll need before constructing any statements.
	const customers = await Promise.all(
		(data.customers ?? []).map(async (customer) => ({
			...customer,
			name: await enc(customer.name),
			email: await enc(customer.email),
			address: await encOrNull(customer.address ?? null),
		})),
	);

	const projects = await Promise.all(
		data.projects.map(async (project) => ({
			...project,
			rate_in_cents: await enc(String(project.rate_in_cents)),
			description: await enc(project.description ?? ""),
		})),
	);

	const timesheets = await Promise.all(
		data.timesheets.map(async (ts) => ({
			...ts,
			description: await encOrNull(ts.description ?? null),
		})),
	);

	const entries = await Promise.all(
		data.timesheetEntries.map(async (entry) => ({
			...entry,
			description: await enc(entry.description),
			amount: await enc(String(entry.amount)),
		})),
	);

	const transactions = await Promise.all(
		data.transactions.map(async (tx) => ({
			...tx,
			description: await enc(tx.description),
			amount: await enc(String(tx.amount)),
		})),
	);

	const invoices = await Promise.all(
		(data.invoices ?? []).map(async (inv) => ({
			...inv,
			amount_cents: await enc(String(inv.amount_cents)),
			description: await encOrNull(inv.description ?? null),
		})),
	);

	const profile = data.userProfile
		? {
				displayName: data.userProfile.displayName ?? "",
				email: data.userProfile.email ?? "",
				venmoHandle: await encOrNull(data.userProfile.venmoHandle),
				paypalHandle: await encOrNull(data.userProfile.paypalHandle),
				businessName: await encOrNull(data.userProfile.businessName),
				businessAddress: await encOrNull(data.userProfile.businessAddress),
			}
		: null;

	const stmts: D1PreparedStatement[] = [];

	// Wipe existing rows in reverse-FK order.
	stmts.push(
		db.prepare("DELETE FROM invoice_events WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM invoices WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM customer_events WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM customers WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM timesheet_entries WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM transactions WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM timesheets WHERE userId = ?").bind(userId),
		db.prepare("DELETE FROM projects WHERE userId = ?").bind(userId),
	);

	// Insert customers first so projects/invoices can FK-link.
	for (const customer of customers) {
		stmts.push(
			db
				.prepare(
					`INSERT INTO customers (id, userId, name, email, address,
					        consentToEmailInvoices, consentedAt, consentRequestedAt,
					        createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					customer.id,
					userId,
					customer.name,
					customer.email,
					customer.address,
					customer.consentToEmailInvoices ? 1 : 0,
					customer.consentedAt ?? null,
					customer.consentRequestedAt ?? null,
					customer.createdAt,
					customer.updatedAt,
				),
		);
	}

	for (const project of projects) {
		stmts.push(
			db
				.prepare(
					`INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt, userId)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					project.id,
					project.name,
					project.active ? 1 : 0,
					project.customerId ?? null,
					project.rate_in_cents,
					project.description,
					project.createdAt,
					project.updatedAt,
					userId,
				),
		);
	}

	for (const ts of timesheets) {
		stmts.push(
			db
				.prepare(
					`INSERT INTO timesheets (id, projectId, name, description, closed, createdAt, updatedAt, userId)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					ts.id,
					ts.projectId,
					ts.name,
					ts.description,
					ts.closed ? 1 : 0,
					ts.createdAt,
					ts.updatedAt,
					userId,
				),
		);
	}

	for (const entry of entries) {
		stmts.push(
			db
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
				),
		);
	}

	for (const tx of transactions) {
		stmts.push(
			db
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
					tx.filePath ?? null,
					tx.createdAt,
					tx.updatedAt,
					userId,
				),
		);
	}

	for (const inv of invoices) {
		stmts.push(
			db
				.prepare(
					`INSERT INTO invoices
					   (id, userId, customerId, timesheetId, number, status,
					    amount_cents, description, issuedAt, dueDate,
					    sentAt, paidAt, voidedAt, archivedAt, createdAt, updatedAt)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					inv.id,
					userId,
					inv.customerId,
					inv.timesheetId ?? null,
					inv.number,
					inv.status,
					inv.amount_cents,
					inv.description,
					inv.issuedAt,
					inv.dueDate,
					inv.sentAt ?? null,
					inv.paidAt ?? null,
					inv.voidedAt ?? null,
					inv.archivedAt ?? null,
					inv.createdAt,
					inv.updatedAt,
				),
		);
	}

	if (profile) {
		stmts.push(
			db
				.prepare(
					`UPDATE users
					 SET displayName = ?, email = ?,
					     venmoHandle = ?, paypalHandle = ?,
					     businessName = ?, businessAddress = ?
					 WHERE id = ?`,
				)
				.bind(
					profile.displayName,
					profile.email,
					profile.venmoHandle,
					profile.paypalHandle,
					profile.businessName,
					profile.businessAddress,
					userId,
				),
		);
	}

	return stmts;
}

// `?confirm=true` is required on every destructive import endpoint so a stray
// frontend call (or a misclick that fires a default-method form) can't wipe
// the user's data without an explicit go-ahead.
function requireConfirm(c: { req: { query: (k: string) => string | undefined } }):
	| { ok: true }
	| { ok: false; response: Response } {
	if (c.req.query("confirm") === "true") return { ok: true };
	return {
		ok: false,
		response: new Response(
			JSON.stringify({
				error:
					"Import requires explicit confirmation — call with ?confirm=true.",
				code: "CONFIRMATION_REQUIRED",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		),
	};
}

// GET /api/export/data?encrypted=true|false - export all data as JSON
app.get("/data", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const wantEncrypted = c.req.query("encrypted") === "true";

	const [
		projects,
		timesheets,
		timesheetEntries,
		transactions,
		customers,
		invoices,
		userProfile,
	] = await Promise.all([
		db
			.prepare(
				`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
				FROM projects WHERE userId = ? ORDER BY id ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, userId, projectId, name, description, closed, createdAt, updatedAt
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
				`SELECT id, userId, name, email, address, consentToEmailInvoices,
				        consentedAt, consentRequestedAt, createdAt, updatedAt
				 FROM customers WHERE userId = ? ORDER BY id ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, userId, customerId, timesheetId, number, status,
				        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
				        voidedAt, archivedAt, createdAt, updatedAt
				 FROM invoices WHERE userId = ? ORDER BY createdAt ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, uuid, displayName, email, venmoHandle, paypalHandle,
				        businessName, businessAddress, createdAt, updatedAt
				 FROM users WHERE id = ?`,
			)
			.bind(userId)
			.first(),
	]);

	let transactionResults = transactions.results as Record<string, unknown>[];
	let projectResults = projects.results as Record<string, unknown>[];
	let timesheetResults = timesheets.results as Record<string, unknown>[];
	let entryResults = timesheetEntries.results as Record<string, unknown>[];
	let customerResults = customers.results as Record<string, unknown>[];
	let invoiceResults = invoices.results as Record<string, unknown>[];
	let profileResult = userProfile as Record<string, unknown> | null;

	if (!wantEncrypted && isEncryptionEnabled(c.env)) {
		transactionResults = await Promise.all(
			transactionResults.map((r) => decryptTransactionRow(r, c.env)),
		);
		projectResults = await Promise.all(
			projectResults.map(async (r) => ({
				...r,
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
			})),
		);
		entryResults = await Promise.all(
			entryResults.map(async (r) => ({
				...r,
				description: await decrypt(r.description as string, c.env),
				amount: Number(await decrypt(r.amount as string, c.env)),
			})),
		);
		customerResults = await Promise.all(
			customerResults.map(async (r) => ({
				...r,
				name: await decrypt(r.name as string, c.env),
				email: await decrypt(r.email as string, c.env),
				address: r.address ? await decrypt(r.address as string, c.env) : null,
			})),
		);
		invoiceResults = await Promise.all(
			invoiceResults.map(async (r) => ({
				...r,
				amount_cents: Number(await decrypt(r.amount_cents as string, c.env)),
				description: r.description
					? await decrypt(r.description as string, c.env)
					: null,
			})),
		);
		if (profileResult) {
			profileResult = {
				...profileResult,
				venmoHandle: profileResult.venmoHandle
					? await decrypt(profileResult.venmoHandle as string, c.env)
					: null,
				paypalHandle: profileResult.paypalHandle
					? await decrypt(profileResult.paypalHandle as string, c.env)
					: null,
				businessName: profileResult.businessName
					? await decrypt(profileResult.businessName as string, c.env)
					: null,
				businessAddress: profileResult.businessAddress
					? await decrypt(profileResult.businessAddress as string, c.env)
					: null,
			};
		}
	}

	const data: ExportData = {
		version: "2.0.0",
		exportDate: new Date().toISOString(),
		encrypted: wantEncrypted && isEncryptionEnabled(c.env),
		projects: projectResults as unknown as ExportData["projects"],
		timesheets: timesheetResults as unknown as ExportData["timesheets"],
		timesheetEntries:
			entryResults as unknown as ExportData["timesheetEntries"],
		transactions: transactionResults as unknown as ExportData["transactions"],
		customers: customerResults as unknown as ExportData["customers"],
		invoices: invoiceResults as unknown as ExportData["invoices"],
		userProfile: profileResult as unknown as ExportData["userProfile"],
	};

	return c.json(data);
});

// POST /api/import/data - import JSON data (replaces existing)
app.post("/data", async (c) => {
	const confirm = requireConfirm(c);
	if (!confirm.ok) return confirm.response;

	const raw = await c.req.json();
	const parsed = exportDataSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid backup file format", issues: parsed.error.issues },
			400,
		);
	}

	const db = getDb(c.env);
	const userId = c.get("userId");

	const stmts = await buildImportBatch(db, parsed.data, userId, c.env);

	// `db.batch` runs as a single SQLite transaction — if any DELETE or
	// INSERT fails, the entire import is rolled back and the user keeps
	// their previous data.
	await db.batch(stmts);

	return c.json({
		projectsCount: parsed.data.projects.length,
		timesheetsCount: parsed.data.timesheets.length,
		entriesCount: parsed.data.timesheetEntries.length,
		transactionsCount: parsed.data.transactions.length,
		customersCount: parsed.data.customers?.length ?? 0,
		invoicesCount: parsed.data.invoices?.length ?? 0,
	});
});

// POST /api/import/zip - import a ZIP backup (data.json + files/)
app.post("/zip", async (c) => {
	const confirm = requireConfirm(c);
	if (!confirm.ok) return confirm.response;

	const arrayBuffer = await c.req.arrayBuffer();
	if (!arrayBuffer || arrayBuffer.byteLength === 0) {
		return c.json({ error: "No ZIP file provided" }, 400);
	}

	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(new Uint8Array(arrayBuffer));
	} catch {
		return c.json({ error: "Invalid ZIP file" }, 400);
	}

	const dataJsonBytes = entries["data.json"];
	if (!dataJsonBytes) {
		return c.json({ error: "ZIP does not contain data.json" }, 400);
	}

	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder().decode(dataJsonBytes));
	} catch {
		return c.json({ error: "data.json is not valid JSON" }, 400);
	}

	const parsed = exportDataSchema.safeParse(raw);
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid backup file format", issues: parsed.error.issues },
			400,
		);
	}

	const db = getDb(c.env);
	const userId = c.get("userId");
	const data = parsed.data;
	const isDataEncrypted = data.encrypted === true;

	// Build the old-key → new-UUID remap before constructing the batch so the
	// transaction inserts transactions with their final filePaths and we don't
	// have to issue a second UPDATE after the batch.
	const fileEntries = Object.entries(entries).filter(([path]) =>
		path.startsWith("files/") && path.length > "files/".length,
	);
	const fileKeyRemap = new Map<string, string>();
	for (const [path] of fileEntries) {
		const oldKey = path.slice("files/".length);
		fileKeyRemap.set(oldKey, crypto.randomUUID());
	}

	// Patch transaction rows in the validated data to use the new R2 keys.
	data.transactions = data.transactions.map((tx) => {
		if (tx.filePath && fileKeyRemap.has(tx.filePath)) {
			return { ...tx, filePath: fileKeyRemap.get(tx.filePath) };
		}
		return tx;
	});

	const stmts = await buildImportBatch(db, data, userId, c.env);
	await db.batch(stmts);

	// R2 writes happen after the DB batch lands. If R2 fails the DB rows are
	// the source of truth — orphaned uploads only happen the other way (an
	// R2 object whose transaction got rolled back), which can't occur because
	// uploads come last.
	// Build a map from new R2 key → linking transaction id so we can write
	// the attachments row with the correct txId on import.
	const txByNewKey = new Map<string, string>();
	for (const tx of data.transactions) {
		if (tx.filePath) txByNewKey.set(tx.filePath, tx.id);
	}

	await Promise.all(
		fileEntries.map(async ([path, bytes]) => {
			const oldKey = path.slice("files/".length);
			const newKey = fileKeyRemap.get(oldKey);
			if (!newKey) return;
			// Encrypted backups store files already encrypted — upload as-is.
			// Plaintext backups store raw file bytes — encrypt before storing.
			const toStore = isDataEncrypted
				? bytes.buffer as ArrayBuffer
				: await encryptBuffer(bytes.buffer as ArrayBuffer, c.env);
			await c.env.FILES_BUCKET.put(newKey, toStore, {
				customMetadata: {
					originalName: oldKey,
					ownerUserId: String(userId),
				},
			});

			// Insert the attachments row so the imported file is tracked by
			// the lifecycle authority. Without this row the cron sweep can't
			// see it, the Files page can't list it, and the download
			// endpoint can't serve it.
			const linkedTxId = txByNewKey.get(newKey) ?? null;
			await db
				.prepare(
					`INSERT INTO attachments (id, userId, originalName, contentType, sizeBytes, txId, attachedAt)
					VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					newKey,
					userId,
					await encrypt(oldKey, c.env),
					"application/octet-stream",
					bytes.byteLength,
					linkedTxId,
					linkedTxId ? new Date().toISOString() : null,
				)
				.run();
		}),
	);

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
// ?encrypted=true keeps DB fields and file bytes in their encrypted form
app.get("/zip", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const wantEncrypted = c.req.query("encrypted") === "true";

	const [
		projects,
		timesheets,
		timesheetEntries,
		transactions,
		customers,
		invoices,
		userProfile,
	] = await Promise.all([
		db
			.prepare(
				`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
				FROM projects WHERE userId = ? ORDER BY id ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, userId, projectId, name, description, closed, createdAt, updatedAt
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
				`SELECT id, userId, name, email, address, consentToEmailInvoices,
				        consentedAt, consentRequestedAt, createdAt, updatedAt
				 FROM customers WHERE userId = ? ORDER BY id ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, userId, customerId, timesheetId, number, status,
				        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
				        voidedAt, archivedAt, createdAt, updatedAt
				 FROM invoices WHERE userId = ? ORDER BY createdAt ASC`,
			)
			.bind(userId)
			.all(),
		db
			.prepare(
				`SELECT id, uuid, displayName, email, venmoHandle, paypalHandle,
				        businessName, businessAddress, createdAt, updatedAt
				 FROM users WHERE id = ?`,
			)
			.bind(userId)
			.first(),
	]);

	let transactionResults = transactions.results as Record<string, unknown>[];
	let projectResults = projects.results as Record<string, unknown>[];
	let timesheetResults = timesheets.results as Record<string, unknown>[];
	let entryResults = timesheetEntries.results as Record<string, unknown>[];
	let customerResults = customers.results as Record<string, unknown>[];
	let invoiceResults = invoices.results as Record<string, unknown>[];
	let profileResult = userProfile as Record<string, unknown> | null;

	if (!wantEncrypted && isEncryptionEnabled(c.env)) {
		transactionResults = await Promise.all(
			transactionResults.map((r) => decryptTransactionRow(r, c.env)),
		);
		projectResults = await Promise.all(
			projectResults.map(async (r) => ({
				...r,
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
			})),
		);
		entryResults = await Promise.all(
			entryResults.map(async (r) => ({
				...r,
				description: await decrypt(r.description as string, c.env),
				amount: Number(await decrypt(r.amount as string, c.env)),
			})),
		);
		customerResults = await Promise.all(
			customerResults.map(async (r) => ({
				...r,
				name: await decrypt(r.name as string, c.env),
				email: await decrypt(r.email as string, c.env),
				address: r.address ? await decrypt(r.address as string, c.env) : null,
			})),
		);
		invoiceResults = await Promise.all(
			invoiceResults.map(async (r) => ({
				...r,
				amount_cents: Number(await decrypt(r.amount_cents as string, c.env)),
				description: r.description
					? await decrypt(r.description as string, c.env)
					: null,
			})),
		);
		if (profileResult) {
			profileResult = {
				...profileResult,
				venmoHandle: profileResult.venmoHandle
					? await decrypt(profileResult.venmoHandle as string, c.env)
					: null,
				paypalHandle: profileResult.paypalHandle
					? await decrypt(profileResult.paypalHandle as string, c.env)
					: null,
				businessName: profileResult.businessName
					? await decrypt(profileResult.businessName as string, c.env)
					: null,
				businessAddress: profileResult.businessAddress
					? await decrypt(profileResult.businessAddress as string, c.env)
					: null,
			};
		}
	}

	const data: ExportData = {
		version: "2.0.0",
		exportDate: new Date().toISOString(),
		encrypted: wantEncrypted && isEncryptionEnabled(c.env),
		projects: projectResults as unknown as ExportData["projects"],
		timesheets: timesheetResults as unknown as ExportData["timesheets"],
		timesheetEntries: entryResults as unknown as ExportData["timesheetEntries"],
		transactions: transactionResults as unknown as ExportData["transactions"],
		customers: customerResults as unknown as ExportData["customers"],
		invoices: invoiceResults as unknown as ExportData["invoices"],
		userProfile: profileResult as unknown as ExportData["userProfile"],
	};

	const zipEntries: Record<string, Uint8Array> = {};

	// Fetch and include all R2 files referenced by transactions
	const filePaths = transactionResults
		.map((tx) => tx.filePath as string | null | undefined)
		.filter((p): p is string => !!p && !/^https?:\/\//i.test(p));

	if (wantEncrypted) {
		// Encrypted export: store R2 file bytes as-is (already encrypted), use UUID keys
		await Promise.all(
			filePaths.map(async (key) => {
				const object = await c.env.FILES_BUCKET.get(key);
				if (!object) return;
				const bytes = await object.arrayBuffer();
				zipEntries[`files/${key}`] = new Uint8Array(bytes);
			}),
		);
	} else {
		// Plaintext export: decrypt files and use descriptive names
		const txByFilePath = new Map<string, { description: string; date: string }>();
		for (const tx of transactionResults) {
			if (tx.filePath && typeof tx.filePath === "string") {
				txByFilePath.set(tx.filePath, {
					description: (tx.description as string) ?? "",
					date: (tx.date as string) ?? "",
				});
			}
		}

		const fileKeyRemap = new Map<string, string>();

		await Promise.all(
			filePaths.map(async (key) => {
				const object = await c.env.FILES_BUCKET.get(key);
				if (!object) return;

				const encryptedBytes = await object.arrayBuffer();
				const decrypted = await decryptBuffer(encryptedBytes, c.env);

				const contentType = object.httpMetadata?.contentType ?? "";
				const extFromContentType = contentTypeToExtension(contentType);
				const originalName = object.customMetadata?.originalName ?? "";
				const extFromName = originalName.includes(".")
					? originalName.slice(originalName.lastIndexOf("."))
					: "";
				const ext = extFromContentType || extFromName;
				const txMeta = txByFilePath.get(key);
				const sanitizedDesc = sanitizeFilename(txMeta?.description ?? "file");
				const date = txMeta?.date ?? "";
				const newKey = `${sanitizedDesc}_${date}_${key}${ext}`;

				fileKeyRemap.set(key, newKey);
				zipEntries[`files/${newKey}`] = new Uint8Array(decrypted);
			}),
		);

		// Update filePaths in the exported transactions to match the new zip entry names
		data.transactions = data.transactions.map((tx) => {
			if (tx.filePath && fileKeyRemap.has(tx.filePath)) {
				return { ...tx, filePath: fileKeyRemap.get(tx.filePath) as string };
			}
			return tx;
		});
	}

	zipEntries["data.json"] = new TextEncoder().encode(JSON.stringify(data, null, 2));

	const zipped = zipSync(zipEntries, { level: 6 });

	const dateStr = new Date().toISOString().split("T")[0];
	const filenameSuffix = wantEncrypted ? "encrypted" : "backup";
	return new Response(zipped, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="paper-trail-${filenameSuffix}-${dateStr}.zip"`,
		},
	});
});

export { app as exportImportRoutes };
