import { Hono } from "hono";
import { z } from "zod";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import {
	renderMinimalInvoiceHtml,
	resolveEmailDelivery,
} from "../lib/emailDelivery";
import { randomHexToken } from "../lib/hash";
import { renderInvoiceHtml } from "../lib/invoiceHtml";
import { assertWithinSendLimit, RateLimitError } from "../lib/rateLimit";
import { ResendError, sendEmail } from "../lib/resend";
import type {
	Env,
	Invoice,
	InvoiceSnapshot,
	InvoiceStatus,
} from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const DEFAULT_DAYS_UNTIL_DUE = 30;

const createInvoiceSchema = z
	.object({
		customerId: z.string().min(1),
		timesheetId: z.string().min(1).optional(),
		amountCents: z.number().int().positive().optional(),
		description: z.string().trim().max(5000).optional(),
		issuedAt: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
		dueDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
	})
	.refine(
		(v) =>
			v.timesheetId != null || (v.amountCents != null && v.amountCents > 0),
		{
			message: "Either timesheetId or amountCents (> 0) is required",
			path: ["amountCents"],
		},
	)
	.refine((v) => !v.issuedAt || !v.dueDate || v.dueDate >= v.issuedAt, {
		message: "dueDate must be on or after issuedAt",
		path: ["dueDate"],
	});

type DbInvoiceRow = {
	id: string;
	userId: number;
	customerId: string;
	timesheetId: string | null;
	number: string;
	status: InvoiceStatus;
	amount_cents: string;
	description: string | null;
	issuedAt: string;
	dueDate: string;
	sentAt: string | null;
	paidAt: string | null;
	voidedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

const decryptInvoice = async (
	row: DbInvoiceRow,
	env: Env,
): Promise<Invoice> => {
	const amount = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount_cents, env))
		: Number(row.amount_cents);
	const description = row.description
		? await decrypt(row.description, env)
		: null;
	return {
		id: row.id,
		userId: row.userId,
		customerId: row.customerId,
		timesheetId: row.timesheetId,
		number: row.number,
		status: row.status,
		amount_cents: amount,
		description,
		issuedAt: row.issuedAt,
		dueDate: row.dueDate,
		sentAt: row.sentAt,
		paidAt: row.paidAt,
		voidedAt: row.voidedAt,
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
};

const nextInvoiceNumber = async (
	userId: number,
	year: number,
	env: Env,
): Promise<string> => {
	const db = getDb(env);
	const prefix = `INV-${year}-`;
	// The highest existing seq for this user/year; lexicographic ordering of
	// zero-padded suffixes matches numeric ordering.
	const row = await db
		.prepare(
			`SELECT number FROM invoices
			 WHERE userId = ? AND number LIKE ?
			 ORDER BY number DESC LIMIT 1`,
		)
		.bind(userId, `${prefix}%`)
		.first<{ number: string }>();
	let nextSeq = 1;
	if (row?.number) {
		const tail = row.number.slice(prefix.length);
		const n = Number.parseInt(tail, 10);
		if (Number.isFinite(n)) nextSeq = n + 1;
	}
	return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

const addDays = (iso: string, days: number): string => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

const logEvent = async (
	invoiceId: string,
	userId: number,
	type: "created" | "sent" | "paid" | "voided" | "viewed",
	payload: Record<string, unknown> | null,
	env: Env,
): Promise<void> => {
	const db = getDb(env);
	const encPayload = payload
		? await encrypt(JSON.stringify(payload), env)
		: null;
	await db
		.prepare(
			`INSERT INTO invoice_events (id, invoiceId, userId, type, payload)
			 VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(crypto.randomUUID(), invoiceId, userId, type, encPayload)
		.run();
};

// ============================================================
// GET /api/v1/invoices
// ============================================================
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const customerId = c.req.query("customerId");
	const status = c.req.query("status") as InvoiceStatus | undefined;
	const year = c.req.query("year");

	const where: string[] = ["userId = ?"];
	const binds: unknown[] = [userId];
	if (customerId) {
		where.push("customerId = ?");
		binds.push(customerId);
	}
	if (status) {
		where.push("status = ?");
		binds.push(status);
	}
	if (year) {
		where.push("substr(issuedAt, 1, 4) = ?");
		binds.push(String(year));
	}

	const { results } = await db
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
			        voidedAt, archivedAt, createdAt, updatedAt
			 FROM invoices WHERE ${where.join(" AND ")}
			 ORDER BY issuedAt DESC, createdAt DESC`,
		)
		.bind(...binds)
		.all<DbInvoiceRow>();

	const decrypted = await Promise.all(
		results.map((row) => decryptInvoice(row, c.env)),
	);
	return c.json(decrypted);
});

// ============================================================
// GET /api/v1/invoices/:id
// ============================================================
app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const row = await db
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
			        voidedAt, archivedAt, createdAt, updatedAt
			 FROM invoices WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first<DbInvoiceRow>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);
	return c.json(await decryptInvoice(row, c.env));
});

// ============================================================
// GET /api/v1/invoices/:id/events
// ============================================================
app.get("/:id/events", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	const invoice = await db
		.prepare("SELECT id FROM invoices WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.first<{ id: string }>();
	if (!invoice) return c.json({ error: "Invoice not found" }, 404);

	const { results } = await db
		.prepare(
			`SELECT id, invoiceId, userId, type, payload, createdAt
			 FROM invoice_events WHERE invoiceId = ? ORDER BY createdAt ASC`,
		)
		.bind(id)
		.all<{
			id: string;
			invoiceId: string;
			userId: number;
			type: string;
			payload: string | null;
			createdAt: string;
		}>();

	const decrypted = await Promise.all(
		results.map(async (row) => ({
			...row,
			payload: row.payload ? await decrypt(row.payload, c.env) : null,
		})),
	);
	return c.json(decrypted);
});

// ============================================================
// POST /api/v1/invoices — create draft
// ============================================================
app.post("/", async (c) => {
	const parsed = createInvoiceSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid invoice", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	// Verify customer belongs to user.
	const cust = await db
		.prepare("SELECT id FROM customers WHERE id = ? AND userId = ?")
		.bind(body.customerId, userId)
		.first<{ id: string }>();
	if (!cust) return c.json({ error: "Customer not found" }, 404);

	const today = new Date().toISOString().slice(0, 10);
	const issuedAt = body.issuedAt ?? today;
	const dueDate = body.dueDate ?? addDays(issuedAt, DEFAULT_DAYS_UNTIL_DUE);

	let totalCents = 0;
	let invoiceDescription: string | null = body.description ?? null;

	if (body.timesheetId) {
		const ts = await db
			.prepare(
				`SELECT t.id, t.projectId, t.name, t.description, t.closed,
				        p.rate_in_cents AS projectRate
				 FROM timesheets t
				 JOIN projects p ON p.id = t.projectId
				 WHERE t.id = ? AND t.userId = ?`,
			)
			.bind(body.timesheetId, userId)
			.first<{
				id: string;
				projectId: string;
				name: string;
				description: string | null;
				closed: number;
				projectRate: string | number | null;
			}>();
		if (!ts) return c.json({ error: "Timesheet not found" }, 404);
		if (ts.closed) return c.json({ error: "Timesheet already closed" }, 400);

		const projectRate = isEncryptionEnabled(c.env)
			? Number(await decrypt(String(ts.projectRate), c.env))
			: Number(ts.projectRate ?? 0);

		const { results: entries } = await db
			.prepare(
				`SELECT date, minutes, description FROM timesheet_entries
				 WHERE timesheetId = ? AND userId = ? ORDER BY date ASC`,
			)
			.bind(body.timesheetId, userId)
			.all<{ date: string; minutes: number; description: string }>();

		let totalMinutes = 0;
		for (const entry of entries) {
			const cents = projectRate
				? Math.round((entry.minutes * projectRate) / 60)
				: 0;
			totalCents += cents;
			totalMinutes += entry.minutes;
		}

		const tsDescription = ts.description
			? await decrypt(ts.description, c.env)
			: "";
		const header = `Rate: $${(projectRate / 100).toFixed(2)}/hour | Total hours: ${(totalMinutes / 60).toFixed(2)}`;
		invoiceDescription = [header, tsDescription, body.description]
			.filter(Boolean)
			.join("\n\n");
	} else {
		totalCents = body.amountCents ?? 0;
	}

	if (totalCents <= 0) {
		return c.json({ error: "Invoice total must be greater than zero" }, 400);
	}

	const year = Number(issuedAt.slice(0, 4));
	const number = await nextInvoiceNumber(userId, year, c.env);
	const invoiceId = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO invoices
			   (id, userId, customerId, timesheetId, number, status,
			    amount_cents, description, issuedAt, dueDate)
			 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
		)
		.bind(
			invoiceId,
			userId,
			body.customerId,
			body.timesheetId ?? null,
			number,
			await encrypt(String(totalCents), c.env),
			invoiceDescription ? await encrypt(invoiceDescription, c.env) : null,
			issuedAt,
			dueDate,
		)
		.run();

	await logEvent(invoiceId, userId, "created", { number }, c.env);

	if (body.timesheetId) {
		await db
			.prepare(
				`UPDATE timesheets SET closed = 1, updatedAt = datetime('now')
				 WHERE id = ? AND userId = ?`,
			)
			.bind(body.timesheetId, userId)
			.run();
	}

	return c.json({ success: true, id: invoiceId, number }, 201);
});

// ============================================================
// Helper: build the snapshot from current DB state
// ============================================================
const buildSnapshot = async (
	row: DbInvoiceRow,
	env: Env,
): Promise<InvoiceSnapshot> => {
	const db = getDb(env);

	const user = await db
		.prepare(
			`SELECT email, venmoHandle, paypalHandle, businessName, businessAddress
			 FROM users WHERE id = ?`,
		)
		.bind(row.userId)
		.first<{
			email: string;
			venmoHandle: string | null;
			paypalHandle: string | null;
			businessName: string | null;
			businessAddress: string | null;
		}>();
	if (!user) throw new Error("User not found");

	const customer = await db
		.prepare(
			"SELECT name, email, address FROM customers WHERE id = ? AND userId = ?",
		)
		.bind(row.customerId, row.userId)
		.first<{ name: string; email: string; address: string | null }>();
	if (!customer) throw new Error("Customer not found");

	const businessName = user.businessName
		? await decrypt(user.businessName, env)
		: "";
	const businessAddress = user.businessAddress
		? await decrypt(user.businessAddress, env)
		: "";
	const venmoHandle = user.venmoHandle
		? await decrypt(user.venmoHandle, env)
		: null;
	const paypalHandle = user.paypalHandle
		? await decrypt(user.paypalHandle, env)
		: null;

	const lineItems: InvoiceSnapshot["lineItems"] = [];

	if (row.timesheetId) {
		const ts = await db
			.prepare(
				`SELECT p.rate_in_cents AS projectRate
				 FROM timesheets t JOIN projects p ON p.id = t.projectId
				 WHERE t.id = ? AND t.userId = ?`,
			)
			.bind(row.timesheetId, row.userId)
			.first<{ projectRate: string | number | null }>();
		const rate = ts
			? isEncryptionEnabled(env)
				? Number(await decrypt(String(ts.projectRate), env))
				: Number(ts.projectRate ?? 0)
			: 0;
		const { results: entries } = await db
			.prepare(
				`SELECT date, minutes, description FROM timesheet_entries
				 WHERE timesheetId = ? AND userId = ? ORDER BY date ASC`,
			)
			.bind(row.timesheetId, row.userId)
			.all<{ date: string; minutes: number; description: string }>();
		for (const e of entries) {
			lineItems.push({
				date: e.date,
				description: await decrypt(e.description, env),
				minutes: e.minutes,
				amountCents: rate ? Math.round((e.minutes * rate) / 60) : 0,
			});
		}
	}

	const amountCents = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount_cents, env))
		: Number(row.amount_cents);
	const description = row.description
		? await decrypt(row.description, env)
		: null;

	return {
		seller: {
			businessName,
			businessAddress,
			email: user.email,
			venmoHandle,
			paypalHandle,
		},
		buyer: {
			name: await decrypt(customer.name, env),
			email: await decrypt(customer.email, env),
			address: customer.address ? await decrypt(customer.address, env) : null,
		},
		invoice: {
			number: row.number,
			id: row.id,
			issuedAt: row.issuedAt,
			dueDate: row.dueDate,
			description,
			amountCents,
		},
		lineItems,
	};
};

// ============================================================
// POST /api/v1/invoices/:id/send — freeze snapshot, email via Resend
// ============================================================
app.post("/:id/send", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
			        voidedAt, archivedAt, createdAt, updatedAt
			 FROM invoices WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first<DbInvoiceRow>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);
	if (row.status === "void" || row.status === "paid") {
		return c.json(
			{ error: `Invoice is ${row.status}`, code: "INVALID_STATE" },
			409,
		);
	}

	// Preconditions: customer consent + seller business identity + config.
	const cust = await db
		.prepare(
			"SELECT name, email, consentToEmailInvoices FROM customers WHERE id = ?",
		)
		.bind(row.customerId)
		.first<{ name: string; email: string; consentToEmailInvoices: number }>();
	if (!cust) return c.json({ error: "Customer not found" }, 404);
	if (!cust.consentToEmailInvoices) {
		return c.json(
			{
				error: "Customer has not consented to email invoices yet.",
				code: "CUSTOMER_NOT_CONSENTED",
			},
			403,
		);
	}

	const user = await db
		.prepare(
			`SELECT email, businessName, businessAddress, resendApiKey, resendFromAddress
			 FROM users WHERE id = ?`,
		)
		.bind(userId)
		.first<{
			email: string;
			businessName: string | null;
			businessAddress: string | null;
			resendApiKey: string | null;
			resendFromAddress: string | null;
		}>();
	if (!user?.businessName || !user.businessAddress) {
		return c.json(
			{
				error:
					"Set your business name and address in Settings before sending invoices.",
				code: "BUSINESS_INFO_MISSING",
			},
			412,
		);
	}
	if (!c.env.APP_BASE_URL) {
		return c.json(
			{
				error: "Email is not configured (APP_BASE_URL).",
				code: "EMAIL_NOT_CONFIGURED",
			},
			500,
		);
	}
	const delivery = await resolveEmailDelivery(user, c.env);
	if ("error" in delivery) {
		return c.json(
			{
				error:
					"Email is not configured. Set RESEND_API_KEY and RESEND_FROM_ADDRESS, or configure your own Resend account in Settings.",
				code: "EMAIL_NOT_CONFIGURED",
			},
			500,
		);
	}

	try {
		await assertWithinSendLimit(userId, c.env);
	} catch (err) {
		if (err instanceof RateLimitError) {
			return c.json(
				{
					error: "Send rate limit exceeded. Try again later.",
					code: "RATE_LIMITED",
					retryAfterSeconds: err.retryAfterSeconds,
				},
				429,
				{ "Retry-After": String(err.retryAfterSeconds) },
			);
		}
		throw err;
	}

	const snapshot = await buildSnapshot(row, c.env);
	const base = c.env.APP_BASE_URL.replace(/\/$/, "");

	const accessToken = randomHexToken(32);
	const hostedUrl = `${base}/invoice/${row.id}?t=${accessToken}`;

	const revokeToken = randomHexToken(32);
	await db
		.prepare("UPDATE customers SET revokeToken = ? WHERE id = ? AND userId = ?")
		.bind(revokeToken, row.customerId, userId)
		.run();
	const revokeUrl = `${base}/consent/revoke/${revokeToken}`;

	const customerEmail = await decrypt(cust.email, c.env);
	const customerName = await decrypt(cust.name, c.env);

	// BYO users get the full rich invoice email; shared-account users get
	// the minimal link-only template so invoice details don't land in the
	// operator's Resend dashboard.
	const html = delivery.usingByo
		? renderInvoiceHtml(snapshot, { hostedUrl, revokeUrl })
		: renderMinimalInvoiceHtml({
				businessName: snapshot.seller.businessName,
				customerName,
				hostedUrl,
				revokeUrl,
			});
	const subject = delivery.usingByo
		? `Invoice ${row.number} from ${snapshot.seller.businessName}`
		: `Invoice from ${snapshot.seller.businessName}`;

	try {
		await sendEmail({
			from: delivery.fromAddress,
			to: customerEmail,
			subject,
			html,
			replyTo: user.email,
			apiKey: delivery.apiKey,
		});
	} catch (err) {
		if (err instanceof ResendError && err.code === "domain_not_verified") {
			return c.json(
				{
					error:
						"Sending domain is not verified in Resend. See docs/EMAIL_SETUP.md.",
					code: "DOMAIN_NOT_VERIFIED",
				},
				412,
			);
		}
		console.error("Invoice send failed", { invoiceId: id });
		return c.json({ error: "Failed to send invoice" }, 502);
	}

	const now = new Date().toISOString();
	await db
		.prepare(
			`UPDATE invoices
			 SET status = 'sent', sentAt = ?, snapshot = ?, accessToken = ?
			 WHERE id = ? AND userId = ?`,
		)
		.bind(
			now,
			await encrypt(JSON.stringify(snapshot), c.env),
			accessToken,
			id,
			userId,
		)
		.run();
	await logEvent(id, userId, "sent", { hostedUrl }, c.env);

	return c.json({ success: true, hostedUrl });
});

// ============================================================
// POST /api/v1/invoices/:id/pay
// ============================================================
app.post("/:id/pay", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	let paidDate: string | null = null;
	try {
		const body = await c.req.json<{ paidDate?: string }>();
		if (body?.paidDate && /^\d{4}-\d{2}-\d{2}$/.test(body.paidDate)) {
			paidDate = body.paidDate;
		}
	} catch {
		// no body — fine
	}

	const row = await db
		.prepare(
			`SELECT id, customerId, status, amount_cents, number, timesheetId
			 FROM invoices WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first<{
			id: string;
			customerId: string;
			status: InvoiceStatus;
			amount_cents: string;
			number: string;
			timesheetId: string | null;
		}>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);
	if (row.status === "paid")
		return c.json({ error: "Already paid", code: "INVALID_STATE" }, 409);
	if (row.status === "void")
		return c.json({ error: "Invoice is void", code: "INVALID_STATE" }, 409);

	const now = new Date().toISOString();
	await db
		.prepare(
			`UPDATE invoices SET status = 'paid', paidAt = ?
			 WHERE id = ? AND userId = ?`,
		)
		.bind(now, id, userId)
		.run();
	await logEvent(id, userId, "paid", null, c.env);

	// Side-effect: create a transaction row attached to the project we can find.
	let projectId: string | null = null;
	if (row.timesheetId) {
		const ts = await db
			.prepare("SELECT projectId FROM timesheets WHERE id = ?")
			.bind(row.timesheetId)
			.first<{ projectId: string }>();
		projectId = ts?.projectId ?? null;
	}
	if (!projectId) {
		const proj = await db
			.prepare(
				"SELECT id FROM projects WHERE customerId = ? AND userId = ? ORDER BY createdAt ASC LIMIT 1",
			)
			.bind(row.customerId, userId)
			.first<{ id: string }>();
		projectId = proj?.id ?? null;
	}

	if (projectId) {
		const amountCents = isEncryptionEnabled(c.env)
			? Number(await decrypt(row.amount_cents, c.env))
			: Number(row.amount_cents);
		await db
			.prepare(
				`INSERT INTO transactions
				   (id, projectId, date, description, amount, filePath, userId)
				 VALUES (?, ?, ?, ?, ?, NULL, ?)`,
			)
			.bind(
				crypto.randomUUID(),
				projectId,
				paidDate ?? now.slice(0, 10),
				await encrypt(`Invoice ${row.number} marked as paid`, c.env),
				await encrypt(String(amountCents), c.env),
				userId,
			)
			.run();
	}

	return c.json({ success: true });
});

// ============================================================
// POST /api/v1/invoices/:id/void
// ============================================================
app.post("/:id/void", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const row = await db
		.prepare("SELECT status FROM invoices WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.first<{ status: InvoiceStatus }>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);
	if (row.status === "paid")
		return c.json(
			{ error: "Cannot void a paid invoice", code: "INVALID_STATE" },
			409,
		);

	const now = new Date().toISOString();
	await db
		.prepare(
			`UPDATE invoices SET status = 'void', voidedAt = ?
			 WHERE id = ? AND userId = ?`,
		)
		.bind(now, id, userId)
		.run();
	await logEvent(id, userId, "voided", null, c.env);
	return c.json({ success: true });
});

export { app as invoiceRoutes };
