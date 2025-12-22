import Stripe from "stripe";

import { getTimesheetById } from "./db";
import { getDb } from "./db/client";

let stripeClient: Stripe | null = null;

async function getStripeClient(): Promise<Stripe | null> {
	const { getStripeSecretKey } = await import("./stronghold");
	const key = await getStripeSecretKey();

	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");

	if (stripeClient) return stripeClient;

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
