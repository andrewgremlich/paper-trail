import { getTimesheetById, type Nullable } from "./db";
import { getDb } from "./db/client";

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
