import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Invoice } from "@/lib/db/types";
import { PayVoidButtons } from ".";

const mockInvoice: Invoice = {
	id: "00000000-0000-0000-0000-000000000001",
	userId: 1,
	customerId: "cust-42",
	timesheetId: "ts-7",
	number: "INV-2026-0001",
	status: "draft",
	amount_cents: 5000,
	description: null,
	issuedAt: "2026-01-01",
	dueDate: "2026-01-31",
	sentAt: null,
	paidAt: null,
	voidedAt: null,
	archivedAt: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

describe("PayVoidButtons", () => {
	const queryClient = new QueryClient();
	const renderComponent = (invoice = mockInvoice) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<PayVoidButtons invoice={invoice} />
			</QueryClientProvider>,
		);

	it("renders Send button on a draft invoice", () => {
		const html = renderComponent();
		expect(html).toContain("Send invoice");
	});

	it("does not render Send on a sent invoice", () => {
		const sent: Invoice = { ...mockInvoice, status: "sent" };
		const html = renderComponent(sent);
		expect(html).not.toContain("Send invoice");
	});

	it("renders the Mark as paid + Void buttons", () => {
		const html = renderComponent();
		expect(html).toContain("Mark as paid");
		expect(html).toContain("Void invoice");
	});

	it("disables Mark/Void when already paid", () => {
		const paid: Invoice = { ...mockInvoice, status: "paid" };
		const html = renderComponent(paid);
		expect(html).toContain("Already paid");
	});

	it("disables Mark/Void when already voided", () => {
		const v: Invoice = { ...mockInvoice, status: "void" };
		const html = renderComponent(v);
		expect(html).toContain("Already voided");
	});

	it("exposes a Copy public URL button", () => {
		const html = renderComponent();
		expect(html).toContain("Copy public URL");
	});
});
