import Stripe from "stripe";

import { getTimesheetById } from "./db";
import { getDb } from "./db/client";
import type { StripeCustomerMinimal, StripeInvoiceMinimal } from "./types";

let stripeClient: Stripe | null = null;

const CURRENCY = "usd";
const DAYS_UNTIL_DUE = 30;

async function getStripeClient(): Promise<Stripe> {
	if (stripeClient) return stripeClient;

	const { getStripeSecretKey } = await import("./files/stronghold");
	const key = await getStripeSecretKey();

	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");

	stripeClient = new Stripe(key);
	return stripeClient;
}

function toMinimalInvoice(invoice: Stripe.Invoice): StripeInvoiceMinimal {
	const status = invoice.status ?? null;
	return {
		id: invoice.id,
		status,
		disabled: ["paid", "void"].includes(status ?? ""),
		pdf: invoice.invoice_pdf,
	};
}

function formatUsd(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

export const generateInvoice = async (formData: FormData): Promise<void> => {
	try {
		const db = await getDb();
		const stripe = await getStripeClient();
		const timesheetId = Number(formData.get("timesheetId") || 0);
		const explicitCustomerId = formData.get("customerId");
		const ts = await getTimesheetById(timesheetId);

		if (!ts) throw new Error("Timesheet not found");
		if (!ts.active) throw new Error("Timesheet already closed");
		if (!explicitCustomerId)
			throw new Error("Customer ID missing for invoice generation");

		const {
			name: timesheetName,
			description: timesheetDescription,
			entries,
			projectRate,
		} = ts;

		const lines: string[] = [];
		let totalHours = 0;
		let totalCents = 0;

		for (const entry of entries) {
			const {
				description: entryDescription,
				minutes: entryMinutes,
				date: entryDate,
			} = entry;
			const amountCents = projectRate
				? Math.round((entryMinutes * projectRate) / 60)
				: 0;
			lines.push(
				`Date: ${entryDate} | Hours: ${entryMinutes / 60} | Amount: ${formatUsd(amountCents)} | Description: ${entryDescription}`,
			);
			totalHours += entryMinutes / 60;
			totalCents += amountCents;
		}

		const taskLog =
			lines.length > 0 ? `Task log:\n${lines.join("\n")}` : undefined;

		const invoice = await stripe.invoices.create({
			customer: explicitCustomerId as string,
			collection_method: "send_invoice",
			days_until_due: DAYS_UNTIL_DUE,
			currency: CURRENCY,
			description: `Rate: ${formatUsd(projectRate ?? 0)} per hour | Total hours: ${totalHours}\n${timesheetDescription ? timesheetDescription : ""}`,
			footer: taskLog,
		});

		if (totalCents > 0) {
			await stripe.invoiceItems.create({
				customer: explicitCustomerId as string,
				invoice: invoice.id,
				currency: CURRENCY,
				amount: totalCents,
				description: `${String(timesheetName)} — ${totalHours} hours`,
			});
		}

		const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

		await stripe.invoices.sendInvoice(finalized.id);

		await db.execute(
			`UPDATE timesheets SET invoiceId = $1, active = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = $2`,
			[invoice.id, timesheetId],
		);
	} catch (err) {
		console.error(err);
		throw err;
	}
};

export async function getInvoice(
	invoiceId: string,
): Promise<StripeInvoiceMinimal> {
	const stripe = await getStripeClient();
	const invoice = await stripe.invoices.retrieve(invoiceId);
	return toMinimalInvoice(invoice);
}

export async function markInvoiceAsPaid(
	invoiceId: string,
): Promise<StripeInvoiceMinimal> {
	const stripe = await getStripeClient();
	const invoice = await stripe.invoices.pay(invoiceId, {
		paid_out_of_band: true,
	});

	// Create a transaction entry for the paid invoice
	try {
		const db = await getDb();
		const { upsertTransaction } = await import("./db/transactions");

		// Get the timesheet associated with this invoice
		const timesheetRows = await db.select<Array<{ projectId: number }>>(
			"SELECT projectId FROM timesheets WHERE invoiceId = $1",
			[invoiceId],
		);

		if (timesheetRows.length > 0) {
			const projectId = timesheetRows[0].projectId;
			const amountInDollars = (invoice.amount_paid ?? 0) / 100;
			const pdfUrl = invoice.invoice_pdf ?? undefined;

			await upsertTransaction({
				projectId,
				date: new Date().toISOString().split("T")[0], // Current date in YYYY-MM-DD format
				description: `Invoice ${invoiceId} marked as paid`,
				amount: amountInDollars,
				filePath: pdfUrl,
			});
		}
	} catch (error) {
		console.error("Error creating transaction for paid invoice:", error);
		// Don't throw - we still want to return the invoice even if transaction creation fails
	}

	return toMinimalInvoice(invoice);
}

export async function voidInvoice(
	invoiceId: string,
): Promise<{ invoice: StripeInvoiceMinimal }> {
	const stripe = await getStripeClient();
	const invoice = await stripe.invoices.voidInvoice(invoiceId);
	return { invoice: toMinimalInvoice(invoice) };
}

export async function getAllCustomers(
	max?: number,
): Promise<StripeCustomerMinimal[]> {
	if (typeof max === "number" && max <= 0) return [];

	const stripe = await getStripeClient();
	const customers: StripeCustomerMinimal[] = [];

	let startingAfter: string | undefined;

	for (let page = 0; page < 50; page++) {
		const remaining =
			typeof max === "number" ? Math.max(0, max - customers.length) : 100;
		if (typeof max === "number" && remaining <= 0) break;
		const pageLimit = Math.min(100, remaining || 100);

		const list = await stripe.customers.list({
			limit: pageLimit,
			starting_after: startingAfter,
		});

		const pageItems: StripeCustomerMinimal[] = (list.data || []).map((c) => ({
			id: c.id,
			name: c.name ?? null,
			email: c.email ?? null,
		}));

		customers.push(...pageItems);

		if (!list.has_more || pageItems.length === 0) break;
		if (typeof max === "number" && customers.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return customers;
}

export interface StripeInvoiceListItem extends StripeInvoiceMinimal {
	amountDue: number;
	amountPaid: number;
	currency: string;
	customerEmail: string | null;
	customerName: string | null;
	customerId: string | null;
	created: number;
	dueDate: number | null;
	number: string | null;
	hostedInvoiceUrl: string | null;
}

export interface GetAllInvoicesOptions {
	max?: number;
	year?: number;
	customerId?: string;
}

export interface CreateOneOffInvoiceParams {
	customerId: string;
	amountCents: number;
	description?: string;
}

export async function createOneOffInvoice(
	params: CreateOneOffInvoiceParams,
): Promise<StripeInvoiceListItem> {
	const { customerId, amountCents, description } = params;

	if (amountCents <= 0) {
		throw new Error("Amount must be greater than zero");
	}

	const stripe = await getStripeClient();

	const invoice = await stripe.invoices.create({
		customer: customerId,
		collection_method: "send_invoice",
		days_until_due: DAYS_UNTIL_DUE,
		currency: CURRENCY,
		description: description || undefined,
	});

	await stripe.invoiceItems.create({
		customer: customerId,
		invoice: invoice.id,
		currency: CURRENCY,
		amount: amountCents,
		description: description || "One-off invoice",
	});

	const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
	await stripe.invoices.sendInvoice(finalized.id);

	const status = finalized.status ?? null;
	return {
		id: finalized.id,
		status,
		disabled: ["paid", "void"].includes(status ?? ""),
		pdf: finalized.invoice_pdf,
		amountDue: finalized.amount_due ?? 0,
		amountPaid: finalized.amount_paid ?? 0,
		currency: finalized.currency ?? CURRENCY,
		customerEmail: finalized.customer_email ?? null,
		customerName: finalized.customer_name ?? null,
		customerId:
			typeof finalized.customer === "string"
				? finalized.customer
				: (finalized.customer?.id ?? null),
		created: finalized.created,
		dueDate: finalized.due_date ?? null,
		number: finalized.number ?? null,
		hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
	};
}

export async function getAllInvoices(
	options: GetAllInvoicesOptions = {},
): Promise<StripeInvoiceListItem[]> {
	const { max, year, customerId } = options;

	if (typeof max === "number" && max <= 0) return [];

	const stripe = await getStripeClient();
	const invoices: StripeInvoiceListItem[] = [];

	// Calculate date range for year filter
	let createdFilter: { gte?: number; lt?: number } | undefined;
	if (year) {
		const startOfYear = new Date(year, 0, 1).getTime() / 1000;
		const startOfNextYear = new Date(year + 1, 0, 1).getTime() / 1000;
		createdFilter = { gte: startOfYear, lt: startOfNextYear };
	}

	let startingAfter: string | undefined;

	for (let page = 0; page < 50; page++) {
		const remaining =
			typeof max === "number" ? Math.max(0, max - invoices.length) : 100;
		if (typeof max === "number" && remaining <= 0) break;
		const pageLimit = Math.min(100, remaining || 100);

		const list = await stripe.invoices.list({
			limit: pageLimit,
			starting_after: startingAfter,
			created: createdFilter,
			customer: customerId,
		});

		const pageItems: StripeInvoiceListItem[] = (list.data || []).map((inv) => {
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
				created: inv.created,
				dueDate: inv.due_date ?? null,
				number: inv.number ?? null,
				hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
			};
		});

		invoices.push(...pageItems);

		if (!list.has_more || pageItems.length === 0) break;
		if (typeof max === "number" && invoices.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return invoices;
}
