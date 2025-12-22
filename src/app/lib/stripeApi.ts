import Stripe from "stripe";

import { getTimesheetById } from "./db";
import { getDb } from "./db/client";
import type { StripeCustomerMinimal, StripeInvoiceMinimal } from "./types";

let stripeClient: Stripe | null = null;

async function getStripeClient(): Promise<Stripe | null> {
	if (stripeClient) return stripeClient;

	const { getStripeSecretKey } = await import("./stronghold");
	const key = await getStripeSecretKey();

	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");

	stripeClient = new Stripe(key);
	return stripeClient;
}

export const generateInvoice = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const stripe = await getStripeClient();
	const timesheetId = String(formData.get("timesheetId") || "");
	const explicitCustomerId = formData.get("customerId");
	const ts = await getTimesheetById(timesheetId);

	if (!ts) throw new Error("Timesheet not found");
	if (ts.closed) throw new Error("Timesheet already closed");
	if (!stripe) throw new Error("Stripe client not initialized");
	if (!explicitCustomerId)
		throw new Error("Customer ID missing for invoice generation");

	const {
		name: timesheetName,
		description: timesheetDescription,
		entries,
		projectRate,
	} = ts;

	let taskLog = "";
	let totalHours = 0;
	let totalAmount = 0;

	for (const entry of entries) {
		const {
			description: entryDescription,
			hours: entryHours,
			date: entryDate,
		} = entry;

		const amount = projectRate ? entryHours * projectRate : 0;

		taskLog += `Date: ${entryDate} | Hours: ${entryHours} | Amount: $${amount.toFixed(2)} | Description: ${entryDescription}\n`;

		totalHours += entryHours;
		totalAmount += amount;
	}

	const invoice = await stripe.invoices.create({
		customer: explicitCustomerId as string,
		collection_method: "send_invoice",
		days_until_due: 30,
		currency: "usd",
		description: `Total hours: ${totalHours}\n${timesheetDescription as string}`,
		footer: taskLog.length > 0 ? `Task log:\n${taskLog}` : undefined,
	});

	if (totalAmount > 0) {
		await stripe.invoiceItems.create({
			customer: explicitCustomerId as string,
			invoice: invoice.id,
			currency: "usd",
			amount: Math.round(totalAmount * 100),
			description: `${String(timesheetName)} — ${totalHours} hours`,
		});
	}

	const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

	await stripe.invoices.sendInvoice(finalized.id);

	await db.execute(
		`UPDATE timesheets SET invoiceId = $1, closed = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2`,
		[invoice.id, timesheetId],
	);
};

export async function getInvoice(
	invoiceId: string,
): Promise<StripeInvoiceMinimal> {
	const stripe = await getStripeClient();

	if (!stripe) throw new Error("Stripe client not initialized");

	const invoice = await stripe.invoices.retrieve(invoiceId);

	return {
		id: invoice.id,
		status: invoice.status ?? null,
		pdf: invoice.invoice_pdf,
	};
}

export async function markInvoiceAsPaid(
	invoiceId: string,
): Promise<StripeInvoiceMinimal> {
	const stripe = await getStripeClient();

	if (!stripe) throw new Error("Stripe client not initialized");

	const invoice = await stripe.invoices.pay(invoiceId, {
		paid_out_of_band: true,
	});

	return {
		id: invoice.id,
		status: invoice.status ?? null,
	};
}

export async function voidInvoice(
	invoiceId: string,
): Promise<{ invoice: StripeInvoiceMinimal }> {
	const stripe = await getStripeClient();

	if (!stripe) throw new Error("Stripe client not initialized");

	const invoice = await stripe.invoices.voidInvoice(invoiceId);
	const minimal: StripeInvoiceMinimal = {
		id: invoice.id,
		status: invoice.status ?? null,
	};
	return { invoice: minimal };
}

export async function getAllCustomers(
	max?: number,
): Promise<StripeCustomerMinimal[]> {
	if (typeof max === "number" && max <= 0) return [];

	const stripe = await getStripeClient();
	const customers: StripeCustomerMinimal[] = [];

	let startingAfter: string | undefined;

	if (!stripe) throw new Error("Stripe client not initialized");

	for (let page = 0; page < 50; page++) {
		const remaining =
			typeof max === "number" ? Math.max(0, max - customers.length) : 100;
		const pageLimit = Math.min(100, remaining || 100);

		const list = await stripe.customers.list({
			limit: pageLimit,
			starting_after: startingAfter,
		});

		let pageItems: StripeCustomerMinimal[] = (list.data || []).map((c) => ({
			id: c.id,
			name: c.name ?? null,
			email: c.email ?? null,
		}));

		if (typeof max === "number") {
			const remainingAfterMap = max - customers.length;
			if (remainingAfterMap <= 0) break;
			if (pageItems.length > remainingAfterMap) {
				pageItems = pageItems.slice(0, remainingAfterMap);
			}
		}

		customers.push(...pageItems);

		if (!list.has_more || pageItems.length === 0) break;
		if (typeof max === "number" && customers.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return customers;
}
