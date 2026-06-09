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

/**
 * Fetches the authed HTML preview for an invoice and opens it in a new
 * tab via a blob URL. Used in place of `window.open('/invoice/<id>')`
 * for drafts — the public hosted route only serves sent invoices.
 */
export const openInvoicePreview = async (id: string): Promise<void> => {
	const res = await api.getRaw(`/invoices/${id}/preview`);
	if (!res.ok) {
		throw new Error(`Failed to load invoice preview (${res.status})`);
	}
	const html = await res.text();
	const blob = new Blob([html], { type: "text/html;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const win = window.open(url, "_blank");
	// Release the object URL once the new tab has had a chance to load it.
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
	if (!win) {
		throw new Error("Browser blocked the preview window");
	}
};

export const markInvoicePaid = (id: string): Promise<{ success: true }> => {
	const today = new Date();
	const paidDate = [
		today.getFullYear(),
		String(today.getMonth() + 1).padStart(2, "0"),
		String(today.getDate()).padStart(2, "0"),
	].join("-");
	return api.post(`/invoices/${id}/pay`, { paidDate });
};

export const publishInvoice = (
	id: string,
): Promise<{ success: true; hostedUrl: string | null }> =>
	api.post(`/invoices/${id}/publish`);

export const voidInvoice = (id: string): Promise<{ success: true }> =>
	api.post(`/invoices/${id}/void`);
