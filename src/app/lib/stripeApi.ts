import { api } from "./db/client";
import type { StripeCustomerMinimal, StripeInvoiceMinimal } from "./types";

export interface StripeInvoiceListItem extends StripeInvoiceMinimal {
	amountDue: number;
	amountPaid: number;
	currency: string;
	customerEmail: string | null;
	customerName: string | null;
	customerId: string | null;
	customer: string | null;
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

export interface StripeInvoiceDetail {
	id: string;
	status: string | null;
	disabled: boolean;
	description: string | null;
	footer: string | null;
	number: string | null;
	customer_email: string | null;
	customer_name: string | null;
	amount_due: number;
	amount_paid: number;
	currency: string;
	created: number;
	due_date: number | null;
	invoice_pdf: string | null;
	hosted_invoice_url: string | null;
}

export interface CreateOneOffInvoiceParams {
	customerId: string;
	amountCents: number;
	description?: string;
}

export const generateInvoice = async (formData: FormData): Promise<void> => {
	const timesheetId = Number(formData.get("timesheetId") || 0);
	const customerId = formData.get("customerId") as string;

	await api.post("/stripe/invoices", { timesheetId, customerId });
};

export async function getInvoice(
	invoiceId: string,
): Promise<StripeInvoiceDetail> {
	return api.get<StripeInvoiceDetail>(`/stripe/invoices/${invoiceId}`);
}

export async function markInvoiceAsPaid(
	invoiceId: string,
): Promise<StripeInvoiceMinimal> {
	return api.post(`/stripe/invoices/${invoiceId}/pay`);
}

export async function voidInvoice(
	invoiceId: string,
): Promise<{ invoice: StripeInvoiceMinimal }> {
	return api.post(`/stripe/invoices/${invoiceId}/void`);
}

export async function getAllCustomers(
	max?: number,
): Promise<StripeCustomerMinimal[]> {
	const params = max !== undefined ? `?max=${max}` : "";
	return api.get(`/stripe/customers${params}`);
}

export async function createOneOffInvoice(
	params: CreateOneOffInvoiceParams,
): Promise<StripeInvoiceListItem> {
	return api.post("/stripe/invoices", {
		customerId: params.customerId,
		amountCents: params.amountCents,
		description: params.description,
	});
}

export async function getAllInvoices(
	options: GetAllInvoicesOptions = {},
): Promise<StripeInvoiceListItem[]> {
	const params = new URLSearchParams();
	if (options.max !== undefined) params.set("max", String(options.max));
	if (options.year !== undefined) params.set("year", String(options.year));
	if (options.customerId) params.set("customerId", options.customerId);

	const qs = params.toString();
	return api.get(`/stripe/invoices${qs ? `?${qs}` : ""}`);
}

export type StripeConnectStatusResult =
	| { connected: false }
	| {
			connected: true;
			stripeUserId: string;
			stripePublishableKey: string | null;
			scope: string | null;
			connectedAt: string;
	  };

export async function getStripeConnectStatus(): Promise<StripeConnectStatusResult> {
	return api.get<StripeConnectStatusResult>("/stripe/connect/status");
}

export async function disconnectStripe(): Promise<{ disconnected: boolean }> {
	return api.post<{ disconnected: boolean }>("/stripe/connect/disconnect");
}

export function getStripeConnectAuthorizeUrl(): string {
	return "/api/v1/stripe/connect/authorize";
}
