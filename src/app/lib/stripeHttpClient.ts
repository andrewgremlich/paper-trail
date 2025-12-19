import { getStripeSecretKey } from "./stronghold";

interface StripeInvoiceMinimal {
	id: string;
	status: string;
	[key: string]: unknown;
}

interface StripeCustomerMinimal {
	id: string;
	name: string | null;
	email: string | null;
}

interface StripeListResponse<T> {
	data: T[];
	has_more?: boolean;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
	const v = obj[key];
	return typeof v === "string" ? v : null;
}

const STRIPE_BASE = "https://api.stripe.com/v1";

async function getAuthHeader(): Promise<string> {
	const key = await getStripeSecretKey();
	if (!key) throw new Error("Stripe secret key not found. Set it in Settings.");
	return `Bearer ${key}`;
}

export async function getInvoice(
	invoiceId: string,
): Promise<{ invoice: StripeInvoiceMinimal }> {
	const auth = await getAuthHeader();
	const resp = await fetch(
		`${STRIPE_BASE}/invoices/${encodeURIComponent(invoiceId)}`,
		{
			method: "GET",
			headers: {
				Authorization: auth,
			},
		},
	);

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to retrieve invoice: ${resp.status} ${text}`);
	}

	const invoice = (await resp.json()) as StripeInvoiceMinimal;
	return { invoice };
}

export async function markInvoiceAsPaid(
	invoiceId: string,
): Promise<{ invoice: StripeInvoiceMinimal }> {
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
		},
	);

	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Failed to mark invoice as paid: ${resp.status} ${text}`);
	}

	const invoice = (await resp.json()) as StripeInvoiceMinimal;
	return { invoice };
}

export async function getAllCustomers(
	secretKey: string,
	max?: number,
): Promise<StripeCustomerMinimal[]> {
	if (typeof max === "number" && max <= 0) return [];
	const customers: StripeCustomerMinimal[] = [];
	let startingAfter: string | undefined;

	// Safety cap to avoid infinite loops if Stripe ever misbehaves
	for (let page = 0; page < 50; page++) {
		const url = new URL(`${STRIPE_BASE}/customers`);
		const remaining =
			typeof max === "number" ? Math.max(0, max - customers.length) : 100;
		const pageLimit = Math.min(100, remaining || 100);
		url.searchParams.set("limit", String(pageLimit));
		if (startingAfter) url.searchParams.set("starting_after", startingAfter);

		const resp = await fetch(url.toString(), {
			method: "GET",
			headers: { Authorization: `Bearer ${secretKey}` },
		});

		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Failed to list customers: ${resp.status} ${text}`);
		}

		const json = (await resp.json()) as StripeListResponse<
			Record<string, unknown>
		>;
		let pageItems: StripeCustomerMinimal[] = (json.data || []).map((c) => {
			const obj = c as Record<string, unknown>;
			const id = readString(obj, "id") ?? "";
			const name = readString(obj, "name");
			const email = readString(obj, "email");
			return { id, name, email };
		});

		if (typeof max === "number") {
			const remainingAfterMap = max - customers.length;
			if (remainingAfterMap <= 0) break;
			if (pageItems.length > remainingAfterMap) {
				pageItems = pageItems.slice(0, remainingAfterMap);
			}
		}

		customers.push(...pageItems);

		if (!json.has_more || pageItems.length === 0) break;
		if (typeof max === "number" && customers.length >= max) break;
		startingAfter = pageItems[pageItems.length - 1]?.id;
		if (!startingAfter) break;
	}

	return customers;
}
