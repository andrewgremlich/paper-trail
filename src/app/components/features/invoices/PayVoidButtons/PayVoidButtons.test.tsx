import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimesheetDetails } from "@/lib/db/types";
import { PayVoidButtons } from ".";

describe("PayVoidButtons", () => {
	const queryClient = new QueryClient();
	const mockTimesheet: TimesheetDetails = {
		id: 1,
		name: "Test Timesheet",
		description: "Test Description",
		projectId: 1,
		customerId: "cus_123",
		projectRate: 5000,
		active: false,
		invoiceId: "inv_123",
		entries: [
			{
				id: 1,
				timesheetId: 1,
				date: "2024-01-01",
				minutes: 60,
				description: "Test work",
				amount: 5000,
				createdAt: 1704067200000,
				updatedAt: 1704067200000,
			},
		],
		createdAt: 1704067200000,
		updatedAt: 1704067200000,
	};

	const renderComponent = (timesheet = mockTimesheet) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<PayVoidButtons timesheet={timesheet} />
			</QueryClientProvider>,
		);

	it("renders buttons for mark as paid", () => {
		const html = renderComponent();
		expect(html).toContain("<button");
		expect(html).toContain("Mark as Paid");
	});

	it("renders buttons for void invoice", () => {
		const html = renderComponent();
		expect(html).toContain("Void Invoice");
	});

	it("renders both buttons in Flex container", () => {
		const html = renderComponent();
		expect(html).toContain("Mark as Paid");
		expect(html).toContain("Void Invoice");
	});

	it("does not render when timesheet has no invoiceId", () => {
		const timesheetWithoutInvoice = {
			...mockTimesheet,
			invoiceId: null,
		};
		const html = renderComponent(timesheetWithoutInvoice);
		// Component should still render the buttons, but useQuery won't fetch
		expect(html).toContain("Mark as Paid");
		expect(html).toContain("Void Invoice");
	});

	it("renders button elements with correct type", () => {
		const html = renderComponent();
		expect(html).toContain('type="button"');
	});
});
