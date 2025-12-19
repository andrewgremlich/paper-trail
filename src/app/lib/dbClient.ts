import Database from "@tauri-apps/plugin-sql";

type Nullable<T> = T | null | undefined;

export type Project = {
	id: string;
	name: string;
	status: string;
	customerId: Nullable<string>;
	rate: Nullable<number>;
	description: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type Timesheet = {
	id: string;
	projectId: string;
	invoiceId: Nullable<string>;
	name: string;
	description: Nullable<string>;
	closed: boolean;
	createdAt: string;
	updatedAt: string;
};

let dbPromise: Promise<Database> | null = null;

const getDb = async (): Promise<Database> => {
	if (!dbPromise) {
		// Uses app data dir by default; Tauri SQL plugin resolves this DSN.
		dbPromise = Database.load("sqlite:paper-trail.db");
	}
	return dbPromise;
};

export const getAllProjects = async (): Promise<Project[]> => {
	const db = await getDb();
	const rows = await db.select<Project[]>(
		`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt
		 FROM projects
		 ORDER BY createdAt DESC`,
	);
	return rows;
};

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	const db = await getDb();
	type TimesheetRow = {
		id: string;
		projectId: string;
		invoiceId: Nullable<string>;
		name: string;
		description: Nullable<string>;
		closed: number | boolean;
		createdAt: string;
		updatedAt: string;
	};

	const rows = await db.select<TimesheetRow[]>(
		`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt
		 FROM timesheets
		 ORDER BY createdAt DESC`,
	);

	return rows.map((r: TimesheetRow) => ({ ...r, closed: !!r.closed }));
};

// Additional helpers used across the app

type MinimalTimesheet = Pick<
	Timesheet,
	"id" | "name" | "description" | "createdAt" | "updatedAt" | "closed"
>;

export type ProjectWithTimesheets = Project & {
	timesheets: MinimalTimesheet[];
};

export const getProjectById = async (
	projectId: string,
): Promise<ProjectWithTimesheets | null> => {
	const db = await getDb();
	const projects = await db.select<Project[]>(
		`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt
		 FROM projects WHERE id = $1`,
		[projectId],
	);
	const project = projects[0];
	if (!project) return null;

	const timesheets = await db.select<
		Array<MinimalTimesheet & { closed: number | boolean }>
	>(
		`SELECT id, name, description, closed, createdAt, updatedAt
		 FROM timesheets WHERE projectId = $1 ORDER BY createdAt DESC`,
		[projectId],
	);

	const normalized: MinimalTimesheet[] = timesheets.map((t) => ({
		...t,
		closed: !!t.closed,
	}));

	return { ...project, timesheets: normalized };
};

export type TimesheetRecord = {
	id: string;
	timesheetId: string;
	date: string;
	hours: number;
	description: string;
	amount: number;
	// derived client-side convenience
	rate: number;
	createdAt: string;
	updatedAt: string;
};

export type TimesheetDetails = Timesheet & {
	records: TimesheetRecord[];
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export const getTimesheetById = async (
	timesheetId: string,
): Promise<TimesheetDetails | null> => {
	const db = await getDb();

	// Join to pull project-level info (customerId, rate)
	const headerRows = await db.select<
		Array<
			{
				id: string;
				projectId: string;
				invoiceId: Nullable<string>;
				name: string;
				description: Nullable<string>;
				closed: number | boolean;
				createdAt: string;
				updatedAt: string;
			} & { customerId: Nullable<string>; projectRate: Nullable<number> }
		>
	>(
		`SELECT t.id, t.projectId, t.invoiceId, t.name, t.description, t.closed, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate as projectRate
		 FROM timesheets t
		 JOIN projects p ON p.id = t.projectId
		 WHERE t.id = $1`,
		[timesheetId],
	);
	const header = headerRows[0];
	if (!header) return null;

	type RecordRow = {
		id: string;
		timesheetId: string;
		date: string;
		hours: number;
		description: string;
		amount: number;
		createdAt: string;
		updatedAt: string;
	};

	const rows = await db.select<RecordRow[]>(
		`SELECT id, timesheetId, date, hours, description, amount, createdAt, updatedAt
		 FROM timesheet_records WHERE timesheetId = $1 ORDER BY date ASC, createdAt ASC`,
		[timesheetId],
	);

	const rate = header.projectRate ?? 0;
	const records: TimesheetRecord[] = rows.map((r) => ({ ...r, rate }));

	const details: TimesheetDetails = {
		id: header.id,
		projectId: header.projectId,
		invoiceId: header.invoiceId,
		name: header.name,
		description: header.description,
		closed: !!header.closed,
		createdAt: header.createdAt,
		updatedAt: header.updatedAt,
		customerId: header.customerId,
		projectRate: header.projectRate,
		records,
	};

	return details;
};

export const generateProject = async (
	formData: FormData,
): Promise<{ project: Project; timesheet: Timesheet }> => {
	const db = await getDb();
	const id = crypto.randomUUID();

	const name = String(formData.get("name") || "").trim();
	const rate = Number(formData.get("rate") || 0);
	const customerId = (formData.get("customerId") || "") as Nullable<string>;
	const description = (formData.get("description") || "") as Nullable<string>;

	await db.execute(
		`INSERT INTO projects (id, name, status, customerId, rate, description)
		 VALUES ($1, $2, 'active', $3, $4, $5)`,
		[
			id,
			name,
			customerId || null,
			Number.isFinite(rate) ? rate : null,
			description || null,
		],
	);

	const createdProject = (
		await db.select<Project[]>(
			`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt FROM projects WHERE id = $1`,
			[id],
		)
	)[0];

	const tsId = crypto.randomUUID();
	const tsName = `${new Date().toLocaleDateString()} Timesheet`;
	const tsDesc = "Initial timesheet";
	await db.execute(
		`INSERT INTO timesheets (id, projectId, name, description, closed)
		 VALUES ($1, $2, $3, $4, 0)`,
		[tsId, id, tsName, tsDesc],
	);

	const createdTsRow = (
		await db.select<
			Array<
				Omit<Timesheet, "closed"> & {
					closed: number | boolean;
				}
			>
		>(
			`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt FROM timesheets WHERE id = $1`,
			[tsId],
		)
	)[0];

	const createdTimesheet: Timesheet = {
		...createdTsRow,
		closed: !!createdTsRow.closed,
	};

	return { project: createdProject, timesheet: createdTimesheet };
};

export const generateTimesheet = async (
	formData: FormData,
): Promise<Timesheet> => {
	const db = await getDb();
	const id = crypto.randomUUID();
	const projectId = String(formData.get("projectId") || "").trim();
	const name = String(formData.get("name") || "").trim();
	const description = (formData.get("description") || "") as Nullable<string>;

	await db.execute(
		`INSERT INTO timesheets (id, projectId, name, description, closed)
		 VALUES ($1, $2, $3, $4, 0)`,
		[id, projectId, name, description || null],
	);

	const row = (
		await db.select<
			Array<
				Omit<Timesheet, "closed"> & {
					closed: number | boolean;
				}
			>
		>(
			`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt FROM timesheets WHERE id = $1`,
			[id],
		)
	)[0];

	return { ...row, closed: !!row.closed };
};

export const createTimesheetRecord = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = crypto.randomUUID();
	const timesheetId = String(formData.get("timesheetId") || "");
	const projectRate = Number(formData.get("projectRate") || 0);
	const date = String(formData.get("date") || "");
	const hours = Number(formData.get("hours") || 0);
	const description = String(formData.get("description") || "").trim();

	const amount = Math.max(0, projectRate) * Math.max(0, hours);

	await db.execute(
		`INSERT INTO timesheet_records (id, timesheetId, date, hours, description, amount)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[id, timesheetId, date, hours, description, amount],
	);
};

export const deleteTimesheetRecord = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute(`DELETE FROM timesheet_records WHERE id = $1`, [id]);
};

export const deleteTimesheet = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute("BEGIN TRANSACTION");
	try {
		await db.execute(`DELETE FROM timesheet_records WHERE timesheetId = $1`, [
			id,
		]);
		await db.execute(`DELETE FROM timesheets WHERE id = $1`, [id]);
		await db.execute("COMMIT");
	} catch (err) {
		await db.execute("ROLLBACK");
		throw err;
	}
};

export const deleteProject = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");

	console.log(`Deleting project and associated timesheets/records: ${id}`);

	// Best-effort transaction to ensure consistency
	await db.execute("BEGIN TRANSACTION");
	try {
		// Remove records for all timesheets under this project
		await db.execute(
			`DELETE FROM timesheet_records WHERE timesheetId IN (
				SELECT id FROM timesheets WHERE projectId = $1
			)`,
			[id],
		);
		// Remove timesheets for this project
		await db.execute(`DELETE FROM timesheets WHERE projectId = $1`, [id]);
		// Finally remove the project
		await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
		await db.execute("COMMIT");
	} catch (err) {
		await db.execute("ROLLBACK");
		throw err;
	}
};

async function stripePost(
	path: string,
	body: URLSearchParams,
): Promise<Response> {
	const { getStripeSecretKey } = await import("./stronghold");
	const key = await getStripeSecretKey();
	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");
	return fetch(`https://api.stripe.com/v1${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});
}

export const generateInvoice = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const timesheetId = String(formData.get("timesheetId") || "");
	const explicitCustomerId = formData.get("customerId");

	// Fetch full timesheet context
	const ts = await getTimesheetById(timesheetId);
	if (!ts) throw new Error("Timesheet not found");
	if (ts.closed) throw new Error("Timesheet already closed");
	const customerId = (explicitCustomerId || ts.customerId) as Nullable<string>;
	if (!customerId)
		throw new Error("Customer ID missing for invoice generation");

	// Create invoice items for each record (amount in cents)
	for (const r of ts.records) {
		const cents = Math.round((r.amount || 0) * 100);
		if (cents <= 0) continue;
		const params = new URLSearchParams();
		params.set("customer", customerId);
		params.set("currency", "usd");
		params.set("amount", String(cents));
		params.set(
			"description",
			`${new Date(r.date).toLocaleDateString()} • ${r.description} • ${r.hours}h @ $${r.rate}/h`,
		);

		const resp = await stripePost("/invoiceitems", params);
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Failed to create invoice item: ${resp.status} ${text}`);
		}
	}

	// Create invoice
	const invParams = new URLSearchParams();
	invParams.set("customer", customerId);
	invParams.set("collection_method", "send_invoice");
	invParams.set("days_until_due", "30");
	invParams.set("description", `Invoice for ${ts.name}`);

	const invResp = await stripePost("/invoices", invParams);
	if (!invResp.ok) {
		const text = await invResp.text();
		throw new Error(`Failed to create invoice: ${invResp.status} ${text}`);
	}
	const invoiceJson = (await invResp.json()) as { id?: string };
	const invoiceId = invoiceJson.id || null;

	// Close the timesheet and store invoice id
	await db.execute(
		`UPDATE timesheets SET invoiceId = $1, closed = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2`,
		[invoiceId, timesheetId],
	);
};

// Accounting persistence helpers
type AccountingTx = {
	id: string;
	date: string;
	description: string;
	account: number;
	category: string;
	amount: number;
	filePath: string | null;
};

const ensureAccountingTable = async (): Promise<void> => {
	const db = await getDb();
	await db.execute(
		`CREATE TABLE IF NOT EXISTS accounting_transactions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			description TEXT NOT NULL,
			account INTEGER NOT NULL,
			category TEXT NOT NULL,
			amount REAL NOT NULL,
			filePath TEXT,
			createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	);
};

export const upsertAccountingTransaction = async (
	tx: AccountingTx,
): Promise<void> => {
	await ensureAccountingTable();
	const db = await getDb();
	await db.execute(
		`INSERT INTO accounting_transactions (id, date, description, account, category, amount, filePath, createdAt, updatedAt)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT(id) DO UPDATE SET
			 date = excluded.date,
			 description = excluded.description,
			 account = excluded.account,
			 category = excluded.category,
			 amount = excluded.amount,
			 filePath = excluded.filePath,
			 updatedAt = CURRENT_TIMESTAMP`,
		[
			tx.id,
			tx.date,
			tx.description,
			tx.account,
			tx.category,
			tx.amount,
			tx.filePath,
		],
	);
};
