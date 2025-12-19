import { getStripeSecretKey } from "./stronghold";

interface StripeInvoiceMinimal {
	id: string;
	status: string;
	[key: string]: unknown;
}

const STRIPE_BASE = "https://api.stripe.com/v1";

async function getAuthHeader(): Promise<string> {
	const key = await getStripeSecretKey();
	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");
	return `Bearer ${key}`;
}

export async function getInvoice(
	invoiceId: string
): Promise<{ invoice: StripeInvoiceMinimal }> {
	const auth = await getAuthHeader();
	const resp = await fetch(`${STRIPE_BASE}/invoices/${encodeURIComponent(invoiceId)}`, {
		method: "GET",
		headers: {
			Authorization: auth,
		},
	});

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to retrieve invoice: ${resp.status} ${text}`);
	}

	const invoice = (await resp.json()) as StripeInvoiceMinimal;
	return { invoice };
}

export async function markInvoiceAsPaid(invoiceId: string): Promise<{ invoice: StripeInvoiceMinimal }> {
	const auth = await getAuthHeader();
	const body = new URLSearchParams({ paid_out_of_band: "true" });

	const resp = await fetch(
		`${STRIPE_BASE}/invoices/${encodeURIComponent(invoiceId)}/pay`,
		{
			method: "POST",
			headers: {
				Authorization: auth,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		}
	);

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to mark invoice as paid: ${resp.status} ${text}`);
	}

	const invoice = (await resp.json()) as StripeInvoiceMinimal;
	return { invoice };
}

