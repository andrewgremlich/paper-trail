import { api } from "./client";
import type {
	CreateInvoice,
	Invoice,
	InvoiceEvent,
	InvoiceStatus,
} from "./types";

export type InvoicesQuery = {
	customerId?: string;
	status?: InvoiceStatus;
	year?: number;
};

export const getInvoices = (query: InvoicesQuery = {}): Promise<Invoice[]> => {
	const params = new URLSearchParams();
	if (query.customerId) params.set("customerId", query.customerId);
	if (query.status) params.set("status", query.status);
	if (query.year != null) params.set("year", String(query.year));
	const qs = params.toString();
	return api.get(`/invoices${qs ? `?${qs}` : ""}`);
};

export const getInvoice = (id: string): Promise<Invoice> =>
	api.get(`/invoices/${id}`);

export const getInvoiceEvents = (id: string): Promise<InvoiceEvent[]> =>
	api.get(`/invoices/${id}/events`);

export const createInvoice = (
	payload: CreateInvoice,
): Promise<{ success: true; id: string; number: string }> =>
	api.post("/invoices", payload);

export const sendInvoice = (
	id: string,
): Promise<{ success: true; hostedUrl: string }> =>
	api.post(`/invoices/${id}/send`);

export const markInvoicePaid = (id: string): Promise<{ success: true }> =>
	api.post(`/invoices/${id}/pay`);

export const voidInvoice = (id: string): Promise<{ success: true }> =>
	api.post(`/invoices/${id}/void`);
