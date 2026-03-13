import { Hono } from "hono";
import Stripe from "stripe";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const CURRENCY = "usd";
const DAYS_UNTIL_DUE = 30;

interface StripeEnv extends Env {
	STRIPE_SECRET_KEY: string;
}

function getStripeClient(env: StripeEnv): Stripe {
	return new Stripe(env.STRIPE_SECRET_KEY);
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

const app = new Hono<{ Bindings: StripeEnv; Variables: AuthVariables }>();

// GET /api/stripe/customers?max=N
app.get("/customers", async (c) => {
	const stripe = getStripeClient(c.env);
	const max = Number(c.req.query("max") ?? 100);

	if (max <= 0) return c.json([]);

	const customers: Array<{
		id: string;
		name: string | null;
		email: string | null;
	}> = [];
	let startingAfter: string | undefined;

	for (let page = 0; page < 50; page++) {
		const remaining = Math.max(0, max - customers.length);
		if (remaining <= 0) break;
		const pageLimit = Math.min(100, remaining);

		const list = await stripe.customers.list({
			limit: pageLimit,
			starting_after: startingAfter,
		});

		const pageItems = (list.data || []).map((cust) => ({
			id: cust.id,
			name: cust.name ?? null,
			email: cust.email ?? null,
		}));

		customers.push(...pageItems);

		if (!list.has_more || pageItems.length === 0) break;
		if (customers.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return c.json(customers);
});

// GET /api/stripe/invoices?max=N&year=YYYY&customerId=X
app.get("/invoices", async (c) => {
	const stripe = getStripeClient(c.env);
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

	const invoices: ReturnType<typeof toInvoiceListItem>[] = [];
	let startingAfter: string | undefined;

	for (let page = 0; page < 50; page++) {
		const remaining = Math.max(0, max - invoices.length);
		if (remaining <= 0) break;
		const pageLimit = Math.min(100, remaining);

		const list = await stripe.invoices.list({
			limit: pageLimit,
			starting_after: startingAfter,
			created: createdFilter,
			customer: customerId,
		});

		const pageItems = (list.data || []).map(toInvoiceListItem);
		invoices.push(...pageItems);

		if (!list.has_more || pageItems.length === 0) break;
		if (invoices.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return c.json(invoices);
});

// GET /api/stripe/invoices/:id
app.get("/invoices/:id", async (c) => {
	const stripe = getStripeClient(c.env);
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

	const stripe = getStripeClient(c.env);
	const db = getDb(c.env);
	const userId = c.get("userId");

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
	const headerResult = await db.execute({
		sql: `SELECT t.id, t.projectId, t.name, t.description, t.active,
			p.rate_in_cents as projectRate
			FROM timesheets t
			JOIN projects p ON p.id = t.projectId
			WHERE t.id = ? AND t.userId = ?`,
		args: [timesheetId, userId],
	});

	if (headerResult.rows.length === 0) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	const ts = headerResult.rows[0];
	if (!ts.active) {
		return c.json({ error: "Timesheet already closed" }, 400);
	}

	const entriesResult = await db.execute({
		sql: `SELECT date, minutes, description FROM timesheet_entries
			WHERE timesheetId = ? AND userId = ? ORDER BY date ASC`,
		args: [timesheetId, userId],
	});

	const projectRate = (ts.projectRate as number) ?? 0;
	const lines: string[] = [];
	let totalHours = 0;
	let totalCents = 0;

	for (const entry of entriesResult.rows) {
		const entryMinutes = entry.minutes as number;
		const amountCents = projectRate
			? Math.round((entryMinutes * projectRate) / 60)
			: 0;
		lines.push(
			`Date: ${entry.date} | Hours: ${entryMinutes / 60} | Amount: ${formatUsd(amountCents)} | Description: ${entry.description}`,
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
		description: `Rate: ${formatUsd(projectRate)} per hour | Total hours: ${totalHours}\n${ts.description ?? ""}`,
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
	await db.execute({
		sql: `UPDATE timesheets SET invoiceId = ?, active = 0, updatedAt = datetime('now') WHERE id = ?`,
		args: [invoice.id, timesheetId],
	});

	return c.json(toInvoiceListItem(finalized), 201);
});

// POST /api/stripe/invoices/:id/pay
app.post("/invoices/:id/pay", async (c) => {
	const stripe = getStripeClient(c.env);
	const db = getDb(c.env);
	const userId = c.get("userId");
	const invoiceId = c.req.param("id");

	const invoice = await stripe.invoices.pay(invoiceId, {
		paid_out_of_band: true,
	});

	// Create transaction for the paid invoice
	try {
		const timesheetRows = await db.execute({
			sql: "SELECT projectId FROM timesheets WHERE invoiceId = ? AND userId = ?",
			args: [invoiceId, userId],
		});

		if (timesheetRows.rows.length > 0) {
			const projectId = timesheetRows.rows[0].projectId as number;
			const amountCents = invoice.amount_paid ?? 0;
			const pdfUrl = invoice.invoice_pdf ?? null;

			await db.execute({
				sql: `INSERT INTO transactions (projectId, date, description, amount, filePath, userId)
					VALUES (?, ?, ?, ?, ?, ?)`,
				args: [
					projectId,
					new Date().toISOString().split("T")[0],
					`Invoice ${invoiceId} marked as paid`,
					amountCents,
					pdfUrl,
					userId,
				],
			});
		}
	} catch (error) {
		console.error("Error creating transaction for paid invoice:", error);
	}

	return c.json(toMinimalInvoice(invoice));
});

// POST /api/stripe/invoices/:id/void
app.post("/invoices/:id/void", async (c) => {
	const stripe = getStripeClient(c.env);
	const invoiceId = c.req.param("id");
	const invoice = await stripe.invoices.voidInvoice(invoiceId);
	return c.json({ invoice: toMinimalInvoice(invoice) });
});

export { app as stripeRoutes };
