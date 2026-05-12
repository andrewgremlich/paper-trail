import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimesheetModal } from ".";

vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		timesheetModalActive: true,
		toggleTimesheetModal: vi.fn(),
		activeTimesheetId: 1,
	}),
}));

vi.mock("@/lib/db", async () => {
	const actual = await vi.importActual("@/lib/db");
	return {
		...actual,
		getTimesheetById: vi.fn(),
		deleteTimesheet: vi.fn(),
	};
});

vi.mock("../CreateTimesheetRecord", () => ({
	CreateTimesheetRecord: () => <div data-testid="create-timesheet-record" />,
}));

vi.mock("../TimesheetTable", () => ({
	TimesheetTable: () => <div data-testid="timesheet-table" />,
}));

vi.mock("../TimesheetEditForm", () => ({
	TimesheetEditForm: () => <div data-testid="timesheet-edit-form" />,
}));

vi.mock("@/components/features/invoices/GenerateInvoice", () => ({
	GenerateInvoice: () => <div data-testid="generate-invoice" />,
}));

vi.mock("@/components/features/invoices/PayVoidButtons", () => ({
	PayVoidButtons: () => <div data-testid="pay-void-buttons" />,
}));

describe("TimesheetModal", () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	beforeEach(() => {
		queryClient.clear();
	});

	const renderComponent = () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		act(() => {
			createRoot(container).render(
				<QueryClientProvider client={queryClient}>
					<TimesheetModal />
				</QueryClientProvider>,
			);
		});
		return document.body.innerHTML;
	};

	it("renders dialog element", () => {
		const html = renderComponent();
		expect(html).toContain("<dialog");
		expect(html).toContain("</dialog>");
	});

	it("renders heading", () => {
		const html = renderComponent();
		expect(html).toContain("Timesheet Invoice Generator");
	});

	it("renders when modal is active", () => {
		const html = renderComponent();
		expect(html).toBeTruthy();
	});
});
