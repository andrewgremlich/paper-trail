import { Hono } from "hono";
import Stripe from "stripe";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const CURRENCY = "usd";
const DAYS_UNTIL_DUE = 30;

class StripeNotConnectedError extends Error {
	constructor() {
		super("Stripe account not connected");
		this.name = "StripeNotConnectedError";
	}
}

async function getStripeClient(
	env: Env,
	db: D1Database,
	userId: number,
): Promise<Stripe> {
	const row = await db
		.prepare("SELECT accessToken FROM stripe_connections WHERE userId = ?")
		.bind(userId)
		.first<{ accessToken: string }>();

	if (row) {
		const accessToken = await decrypt(row.accessToken, env);
		return new Stripe(accessToken, { telemetry: false });
	}

	if (env.STRIPE_SECRET_KEY) {
		return new Stripe(env.STRIPE_SECRET_KEY, { telemetry: false });
	}

	throw new StripeNotConnectedError();
}

function formatUsd(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

function toMinimalInvoice(invoice: Stripe.Invoice) {
	const status = invoice.status ?? null;
	return {
		id: invoice.id,
		status,
		disabled: ["paid", "void"].includes(status ?? ""),
		pdf: invoice.invoice_pdf,
	};
}

function toInvoiceListItem(inv: Stripe.Invoice) {
	const status = inv.status ?? null;
	return {
		id: inv.id,
		status,
		disabled: ["paid", "void"].includes(status ?? ""),
		pdf: inv.invoice_pdf,
		amountDue: inv.amount_due ?? 0,
		amountPaid: inv.amount_paid ?? 0,
		currency: inv.currency ?? CURRENCY,
		customerEmail: inv.customer_email ?? null,
		customerName: inv.customer_name ?? null,
		customerId:
			typeof inv.customer === "string"
				? inv.customer
				: (inv.customer?.id ?? null),
		customer:
			typeof inv.customer === "string"
				? inv.customer
				: (inv.customer?.id ?? null),
		created: inv.created,
		dueDate: inv.due_date ?? null,
		number: inv.number ?? null,
		hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
	};
}

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/stripe/customers?max=N
app.get("/customers", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	const max = Number(c.req.query("max") ?? 100);

	if (max <= 0) return c.json([]);

	const results = await stripe.customers
		.list({ limit: 100 })
		.autoPagingToArray({ limit: max });

	const customers = results.map((cust) => ({
		id: cust.id,
		name: cust.name ?? null,
		email: cust.email ?? null,
	}));

	return c.json(customers);
});

// GET /api/stripe/invoices?max=N&year=YYYY&customerId=X
app.get("/invoices", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	const max = Number(c.req.query("max") ?? 100);
	const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
	const customerId = c.req.query("customerId") || undefined;

	if (max <= 0) return c.json([]);

	let createdFilter: { gte?: number; lt?: number } | undefined;
	if (year) {
		createdFilter = {
			gte: new Date(year, 0, 1).getTime() / 1000,
			lt: new Date(year + 1, 0, 1).getTime() / 1000,
		};
	}

	const results = await stripe.invoices
		.list({ limit: 100, created: createdFilter, customer: customerId })
		.autoPagingToArray({ limit: max });

	return c.json(results.map(toInvoiceListItem));
});

// GET /api/stripe/invoices/:id
app.get("/invoices/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	const invoiceId = c.req.param("id");
	const invoice = await stripe.invoices.retrieve(invoiceId);
	return c.json({
		...invoice,
		disabled: ["paid", "void"].includes(invoice.status ?? ""),
	});
});

// POST /api/stripe/invoices - generate invoice from timesheet
app.post("/invoices", async (c) => {
	const body = await c.req.json<{
		timesheetId?: number;
		customerId: string;
		amountCents?: number;
		description?: string;
	}>();

	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	// One-off invoice (no timesheet)
	if (!body.timesheetId) {
		if (!body.amountCents || body.amountCents <= 0) {
			return c.json({ error: "Amount must be greater than zero" }, 400);
		}

		const invoice = await stripe.invoices.create({
			customer: body.customerId,
			collection_method: "send_invoice",
			days_until_due: DAYS_UNTIL_DUE,
			currency: CURRENCY,
			description: body.description || undefined,
		});

		await stripe.invoiceItems.create({
			customer: body.customerId,
			invoice: invoice.id,
			currency: CURRENCY,
			amount: body.amountCents,
			description: body.description || "One-off invoice",
		});

		const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
		await stripe.invoices.sendInvoice(finalized.id);

		return c.json(toInvoiceListItem(finalized), 201);
	}

	// Timesheet-based invoice
	const timesheetId = body.timesheetId;

	// Get timesheet with entries
	const ts = await db
		.prepare(
			`SELECT t.id, t.projectId, t.name, t.description, t.active,
			p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.id = ? AND t.userId = ?`,
		)
		.bind(timesheetId, userId)
		.first();

	if (!ts) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	if (!ts.active) {
		return c.json({ error: "Timesheet already closed" }, 400);
	}

	const { results: entriesRows } = await db
		.prepare(
			`SELECT date, minutes, description FROM timesheet_entries
			WHERE timesheetId = ? AND userId = ? ORDER BY date ASC`,
		)
		.bind(timesheetId, userId)
		.all();

	const projectRate = isEncryptionEnabled(c.env)
		? Number(await decrypt(ts.projectRate as string, c.env))
		: ((ts.projectRate as number) ?? 0);
	const lines: string[] = [];
	let totalHours = 0;
	let totalCents = 0;

	for (const entry of entriesRows) {
		const entryMinutes = entry.minutes as number;
		const entryDescription = await decrypt(entry.description as string, c.env);
		const amountCents = projectRate
			? Math.round((entryMinutes * projectRate) / 60)
			: 0;
		lines.push(
			`Date: ${entry.date} | Hours: ${entryMinutes / 60} | Amount: ${formatUsd(amountCents)} | Description: ${entryDescription}`,
		);
		totalHours += entryMinutes / 60;
		totalCents += amountCents;
	}

	const taskLog =
		lines.length > 0 ? `Task log:\n${lines.join("\n")}` : undefined;

	const invoice = await stripe.invoices.create({
		customer: body.customerId,
		collection_method: "send_invoice",
		days_until_due: DAYS_UNTIL_DUE,
		currency: CURRENCY,
		description: `Rate: ${formatUsd(projectRate)} per hour | Total hours: ${totalHours}\n${ts.description ? await decrypt(ts.description as string, c.env) : ""}`,
		footer: taskLog,
	});

	if (totalCents > 0) {
		await stripe.invoiceItems.create({
			customer: body.customerId,
			invoice: invoice.id,
			currency: CURRENCY,
			amount: totalCents,
			description: `${String(ts.name)} — ${totalHours} hours`,
		});
	}

	const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
	await stripe.invoices.sendInvoice(finalized.id);

	// Update timesheet
	const encInvoiceId = await encrypt(invoice.id, c.env);
	await db
		.prepare(
			`UPDATE timesheets SET invoiceId = ?, active = 0, updatedAt = datetime('now') WHERE id = ?`,
		)
		.bind(encInvoiceId, timesheetId)
		.run();

	return c.json(toInvoiceListItem(finalized), 201);
});

// POST /api/stripe/invoices/:id/pay
app.post("/invoices/:id/pay", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	const invoiceId = c.req.param("id");

	const invoice = await stripe.invoices.pay(invoiceId, {
		paid_out_of_band: true,
	});

	// Create transaction for the paid invoice
	try {
		// invoiceId is encrypted with random IV — scan and decrypt to match
		const { results: tsRows } = await db
			.prepare(
				"SELECT projectId, invoiceId FROM timesheets WHERE invoiceId IS NOT NULL AND userId = ?",
			)
			.bind(userId)
			.all();

		let timesheetRow: Record<string, unknown> | null = null;
		for (const row of tsRows) {
			const decryptedId = await decrypt(
				(row as Record<string, unknown>).invoiceId as string,
				c.env,
			);
			if (decryptedId === invoiceId) {
				timesheetRow = row as Record<string, unknown>;
				break;
			}
		}

		if (timesheetRow) {
			const projectId = timesheetRow.projectId as number;
			const amountCents = invoice.amount_paid ?? 0;
			const pdfUrl = invoice.invoice_pdf ?? null;

			const encDescription = await encrypt(
				`Invoice ${invoiceId} marked as paid`,
				c.env,
			);
			const encAmount = await encrypt(String(amountCents), c.env);

			await db
				.prepare(
					`INSERT INTO transactions (projectId, date, description, amount, filePath, userId)
					VALUES (?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					projectId,
					new Date().toISOString().split("T")[0],
					encDescription,
					encAmount,
					pdfUrl,
					userId,
				)
				.run();
		}
	} catch (error) {
		console.error("Error creating transaction for paid invoice:", error);
	}

	return c.json(toMinimalInvoice(invoice));
});

// POST /api/stripe/invoices/:id/void
app.post("/invoices/:id/void", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	let stripe: Stripe;
	try {
		stripe = await getStripeClient(c.env, db, userId);
	} catch (err) {
		if (err instanceof StripeNotConnectedError) {
			return c.json(
				{
					error: "Stripe account not connected. Connect your Stripe account in Settings.",
				},
				402,
			);
		}
		throw err;
	}

	const invoiceId = c.req.param("id");
	const invoice = await stripe.invoices.voidInvoice(invoiceId);
	return c.json({ invoice: toMinimalInvoice(invoice) });
});

// =====================
// Stripe Connect OAuth routes
// =====================

// GET /api/stripe/connect/authorize — redirect to Stripe OAuth
app.get("/connect/authorize", (c) => {
	if (!c.env.STRIPE_CLIENT_ID || !c.env.STRIPE_CONNECT_REDIRECT_URI) {
		return c.json({ error: "Stripe Connect is not configured on this server." }, 501);
	}
	const params = new URLSearchParams({
		response_type: "code",
		client_id: c.env.STRIPE_CLIENT_ID,
		scope: "read_write",
		redirect_uri: c.env.STRIPE_CONNECT_REDIRECT_URI,
	});
	return c.redirect(
		`https://connect.stripe.com/oauth/authorize?${params.toString()}`,
	);
});

// GET /api/stripe/connect/callback — exchange code for tokens and store
app.get("/connect/callback", async (c) => {
	const code = c.req.query("code");
	const error = c.req.query("error");

	if (error || !code) {
		return c.redirect(
			`/?connect_error=${encodeURIComponent(error ?? "missing_code")}`,
		);
	}

	const db = getDb(c.env);
	const userId = c.get("userId");

	const tokenResponse = await fetch(
		"https://connect.stripe.com/oauth/token",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_secret: c.env.STRIPE_CLIENT_SECRET,
				code,
				grant_type: "authorization_code",
			}),
		},
	);

	if (!tokenResponse.ok) {
		const body = await tokenResponse.text();
		console.error("Stripe OAuth token exchange error:", body);
		return c.redirect("/?connect_error=token_exchange_failed");
	}

	const tokenData = await tokenResponse.json<{
		access_token: string;
		refresh_token: string | null;
		stripe_user_id: string;
		stripe_publishable_key: string;
		scope: string;
		error?: string;
		error_description?: string;
	}>();

	if (tokenData.error) {
		return c.redirect(
			`/?connect_error=${encodeURIComponent(tokenData.error_description ?? tokenData.error)}`,
		);
	}

	const encAccessToken = await encrypt(tokenData.access_token, c.env);
	const encRefreshToken = tokenData.refresh_token
		? await encrypt(tokenData.refresh_token, c.env)
		: null;

	await db
		.prepare(
			`INSERT INTO stripe_connections
				(userId, accessToken, refreshToken, stripeUserId, stripePublishableKey, scope, connectedAt)
			VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
			ON CONFLICT(userId) DO UPDATE SET
				accessToken = excluded.accessToken,
				refreshToken = excluded.refreshToken,
				stripeUserId = excluded.stripeUserId,
				stripePublishableKey = excluded.stripePublishableKey,
				scope = excluded.scope,
				connectedAt = datetime('now'),
				updatedAt = datetime('now')`,
		)
		.bind(
			userId,
			encAccessToken,
			encRefreshToken,
			tokenData.stripe_user_id,
			tokenData.stripe_publishable_key,
			tokenData.scope,
		)
		.run();

	return c.redirect("/?connect_success=1");
});

// POST /api/stripe/connect/disconnect — remove stored connection
app.post("/connect/disconnect", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM stripe_connections WHERE userId = ?")
		.bind(userId)
		.run();

	return c.json({ disconnected: true });
});

// GET /api/stripe/connect/status — return connection state (no token exposed)
app.get("/connect/status", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			`SELECT stripeUserId, stripePublishableKey, scope, connectedAt
			FROM stripe_connections WHERE userId = ?`,
		)
		.bind(userId)
		.first<{
			stripeUserId: string;
			stripePublishableKey: string | null;
			scope: string | null;
			connectedAt: string;
		}>();

	if (row) {
		return c.json({
			connected: true,
			mode: "connect" as const,
			stripeUserId: row.stripeUserId,
			stripePublishableKey: row.stripePublishableKey,
			scope: row.scope,
			connectedAt: row.connectedAt,
		});
	}

	if (c.env.STRIPE_SECRET_KEY) {
		return c.json({ connected: true, mode: "secret_key" as const });
	}

	return c.json({ connected: false });
});

export { app as stripeRoutes };
