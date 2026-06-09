import { Hono } from "hono";
import { decrypt, encrypt, isEncryptionEnabled } from "../../lib/crypto";
import { getDb } from "../../lib/db";
import {
	renderMinimalInvoiceHtml,
	resolveEmailDelivery,
} from "../../lib/emailDelivery";
import { randomHexToken } from "../../lib/hash";
import { renderInvoiceHtml } from "../../lib/invoiceHtml";
import { assertWithinSendLimit, RateLimitError } from "../../lib/rateLimit";
import { ResendError, sendEmail } from "../../lib/resend";
import type { Env, InvoiceStatus } from "../../lib/types";
import type { AuthVariables } from "../../middleware/auth";
import {
	addDays,
	buildSnapshot,
	decryptInvoice,
	logEvent,
	nextInvoiceNumber,
} from "./helpers";
import { createInvoiceSchema, type DbInvoiceRow } from "./types";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const DEFAULT_DAYS_UNTIL_DUE = 30;

// INV1: per-invoice access tokens expire 90 days after each send. The
// public route 404s past the expiry; the operator can re-send to mint a
// fresh token + window.
const ACCESS_TOKEN_TTL_DAYS = 90;

// ============================================================
// GET /api/v1/invoices
// ============================================================
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");
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
		results.map((row) => decryptInvoice(row, enc, c.env)),
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
	const enc = c.get("dek");
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
	return c.json(await decryptInvoice(row, enc, c.env));
});

// ============================================================
// GET /api/v1/invoices/:id/events
// ============================================================
app.get("/:id/events", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

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
			payload: row.payload ? await decrypt(row.payload, enc) : null,
		})),
	);
	return c.json(decrypted);
});

// ============================================================
// GET /api/v1/invoices/:id/preview — authed HTML preview
//
// Returns the rendered invoice HTML for the authenticated owner. Used by
// the app's "Open invoice page" / "Preview" actions. Drafts render from
// live data; sent invoices render from the frozen snapshot. Either way
// this route is the only path that exposes draft state — the public
// /invoice/:id route returns 404 on drafts.
// ============================================================
app.get("/:id/preview", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	const row = await db
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, sentAt, paidAt,
			        voidedAt, archivedAt, createdAt, updatedAt, snapshot
			 FROM invoices WHERE id = ? AND userId = ? AND archivedAt IS NULL`,
		)
		.bind(id, userId)
		.first<DbInvoiceRow & { snapshot: string | null }>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);

	let snapshot = null;
	if (row.snapshot) {
		try {
			snapshot = JSON.parse(await decrypt(row.snapshot, enc));
		} catch {
			snapshot = null;
		}
	}
	if (!snapshot) {
		snapshot = await buildSnapshot(row, enc, c.env);
	}

	const html = renderInvoiceHtml(snapshot, {
		isDraftPreview: row.status === "draft",
		status: row.status,
	});
	return c.html(html, 200, {
		"Cache-Control": "no-store",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
		"Content-Security-Policy":
			"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
	});
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
	const enc = c.get("dek");

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
			? Number(await decrypt(String(ts.projectRate), enc))
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
			? await decrypt(ts.description, enc)
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
			await encrypt(String(totalCents), enc),
			invoiceDescription ? await encrypt(invoiceDescription, enc) : null,
			issuedAt,
			dueDate,
		)
		.run();

	await logEvent(invoiceId, userId, "created", { number }, enc, c.env);

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
// POST /api/v1/invoices/:id/send — freeze snapshot, email via Resend
// ============================================================
app.post("/:id/send", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

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

	const cust = await db
		.prepare(
			"SELECT name, email, consentToEmailInvoices FROM customers WHERE id = ? AND userId = ?",
		)
		.bind(row.customerId, userId)
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
	const delivery = await resolveEmailDelivery(user, c.env, enc);
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

	const customerEmail = await decrypt(cust.email, enc);
	const customerName = await decrypt(cust.name, enc);

	try {
		await assertWithinSendLimit(userId, c.env, customerEmail);
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

	const snapshot = await buildSnapshot(row, enc, c.env);
	const base = c.env.APP_BASE_URL.replace(/\/$/, "");

	const accessToken = randomHexToken(32);
	const hostedUrl = `${base}/invoice/${row.id}?t=${accessToken}`;

	const revokeToken = randomHexToken(32);
	await db
		.prepare("UPDATE customers SET revokeToken = ? WHERE id = ? AND userId = ?")
		.bind(revokeToken, row.customerId, userId)
		.run();
	const revokeUrl = `${base}/consent/revoke/${revokeToken}`;

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
	const accessTokenExpiresAt = new Date(
		Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
	await db
		.prepare(
			`UPDATE invoices
			 SET status = 'sent', sentAt = ?, snapshot = ?,
			     accessToken = ?, accessTokenExpiresAt = ?
			 WHERE id = ? AND userId = ?`,
		)
		.bind(
			now,
			await encrypt(JSON.stringify(snapshot), enc),
			accessToken,
			accessTokenExpiresAt,
			id,
			userId,
		)
		.run();
	await logEvent(id, userId, "sent", { hostedUrl }, enc, c.env);

	return c.json({ success: true, hostedUrl });
});

// ============================================================
// POST /api/v1/invoices/:id/pay
// ============================================================
app.post("/:id/pay", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

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
	await logEvent(id, userId, "paid", null, enc, c.env);

	let projectId: string | null = null;
	if (row.timesheetId) {
		const ts = await db
			.prepare("SELECT projectId FROM timesheets WHERE id = ? AND userId = ?")
			.bind(row.timesheetId, userId)
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
			? Number(await decrypt(row.amount_cents, enc))
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
				await encrypt(`Invoice ${row.number} marked as paid`, enc),
				await encrypt(String(amountCents), enc),
				userId,
			)
			.run();
	}

	return c.json({ success: true });
});

// ============================================================
// POST /api/v1/invoices/:id/publish — finalize without emailing
//
// Flips a draft to 'published'. Like /send, it freezes the snapshot and
// mints an access token so the public hosted page (/invoice/<id>) renders
// and "Copy public URL" resolves — but it does NOT email the customer.
// The operator can still hit /send afterwards to email it (the send guard
// allows 'published'), which re-freezes the snapshot and rotates the
// token.
// ============================================================
app.post("/:id/publish", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

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
	if (row.status !== "draft") {
		return c.json(
			{
				error: `Only draft invoices can be published (status is ${row.status})`,
				code: "INVALID_STATE",
			},
			409,
		);
	}

	const snapshot = await buildSnapshot(row, enc, c.env);
	const accessToken = randomHexToken(32);
	const accessTokenExpiresAt = new Date(
		Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();

	await db
		.prepare(
			`UPDATE invoices
			 SET status = 'published', snapshot = ?,
			     accessToken = ?, accessTokenExpiresAt = ?,
			     updatedAt = datetime('now')
			 WHERE id = ? AND userId = ?`,
		)
		.bind(
			await encrypt(JSON.stringify(snapshot), enc),
			accessToken,
			accessTokenExpiresAt,
			id,
			userId,
		)
		.run();

	const base = c.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
	const hostedUrl = base ? `${base}/invoice/${row.id}?t=${accessToken}` : null;
	await logEvent(
		id,
		userId,
		"published",
		hostedUrl ? { hostedUrl } : null,
		enc,
		c.env,
	);
	return c.json({ success: true, hostedUrl });
});

// ============================================================
// POST /api/v1/invoices/:id/rotate-link — mint a fresh access token
//
// Rotates the per-invoice access token (and resets its 90-day window)
// WITHOUT emailing and WITHOUT touching the frozen snapshot. Use when the
// operator needs a fresh shareable link for an already-published/sent
// invoice, or wants to invalidate a previously-shared link.
//
// Snapshot is deliberately left immutable: it's the tamper-evident record
// of what was billed, so re-freezing it here could silently change what
// the customer agreed to. This only refreshes ACCESS to the same invoice.
//
// Only invoices that already have a snapshot + token are eligible
// (published / sent / paid). Drafts have no link yet (use publish/send);
// void invoices are cancelled and must not have their access extended.
// ============================================================
app.post("/:id/rotate-link", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			"SELECT id, status, snapshot FROM invoices WHERE id = ? AND userId = ?",
		)
		.bind(id, userId)
		.first<{ id: string; status: InvoiceStatus; snapshot: string | null }>();
	if (!row) return c.json({ error: "Invoice not found" }, 404);
	if (
		!row.snapshot ||
		(row.status !== "published" &&
			row.status !== "sent" &&
			row.status !== "paid")
	) {
		return c.json(
			{
				error: `Only published, sent, or paid invoices can rotate their link (status is ${row.status})`,
				code: "INVALID_STATE",
			},
			409,
		);
	}

	const accessToken = randomHexToken(32);
	const accessTokenExpiresAt = new Date(
		Date.now() + ACCESS_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();

	await db
		.prepare(
			`UPDATE invoices
			 SET accessToken = ?, accessTokenExpiresAt = ?,
			     updatedAt = datetime('now')
			 WHERE id = ? AND userId = ?`,
		)
		.bind(accessToken, accessTokenExpiresAt, id, userId)
		.run();

	const base = c.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
	const hostedUrl = base ? `${base}/invoice/${row.id}?t=${accessToken}` : null;
	return c.json({ success: true, hostedUrl });
});

// ============================================================
// POST /api/v1/invoices/:id/void
// ============================================================
app.post("/:id/void", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");
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
	await logEvent(id, userId, "voided", null, enc, c.env);
	return c.json({ success: true });
});

export { app as invoiceRoutes };
