import { api } from "./client";
import type {
	CreateInvoice,
	Invoice,
	InvoiceEvent,
	InvoiceStatus,
} from "./types";

export type InvoicesQuery = {
	customerId?: number;
	status?: InvoiceStatus;
	year?: number;
};

export const getInvoices = (query: InvoicesQuery = {}): Promise<Invoice[]> => {
	const params = new URLSearchParams();
	if (query.customerId != null)
		params.set("customerId", String(query.customerId));
	if (query.status) params.set("status", query.status);
	if (query.year != null) params.set("year", String(query.year));
	const qs = params.toString();
	return api.get(`/invoices${qs ? `?${qs}` : ""}`);
};

export const getInvoice = (id: number): Promise<Invoice> =>
	api.get(`/invoices/${id}`);

export const getInvoiceEvents = (id: number): Promise<InvoiceEvent[]> =>
	api.get(`/invoices/${id}/events`);

export const createInvoice = (
	payload: CreateInvoice,
): Promise<{ success: true; id: number; uuid: string; number: string }> =>
	api.post("/invoices", payload);

export const sendInvoice = (
	id: number,
): Promise<{ success: true; hostedUrl: string }> =>
	api.post(`/invoices/${id}/send`);

export const markInvoicePaid = (id: number): Promise<{ success: true }> =>
	api.post(`/invoices/${id}/pay`);

export const voidInvoice = (id: number): Promise<{ success: true }> =>
	api.post(`/invoices/${id}/void`);
