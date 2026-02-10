import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimesheetDetails } from "@/lib/db";
import { GenerateInvoice } from ".";

describe("GenerateInvoice", () => {
	const queryClient = new QueryClient();
	const mockTimesheet: TimesheetDetails = {
		id: 1,
		userId: 1,
		name: "Test Timesheet",
		description: "Test Description",
		projectId: 1,
		customerId: "cus_123",
		projectRate: 5000,
		active: true,
		invoiceId: null,
		entries: [
			{
				id: 1,
				userId: 1,
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

	const renderComponent = (timesheet = mockTimesheet, activeTimesheetId = 1) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<GenerateInvoice
					timesheet={timesheet}
					activeTimesheetId={activeTimesheetId}
				/>
			</QueryClientProvider>,
		);

	it("renders form element", () => {
		const html = renderComponent();
		expect(html).toContain("<form");
		expect(html).toContain("</form>");
	});

	it("renders hidden input for timesheetId", () => {
		const html = renderComponent();
		expect(html).toContain('name="timesheetId"');
		expect(html).toContain('value="1"');
	});

	it("renders hidden input for customerId when present", () => {
		const html = renderComponent();
		expect(html).toContain('name="customerId"');
		expect(html).toContain('value="cus_123"');
	});

	it("does not render customerId input when not present", () => {
		const timesheetWithoutCustomer = {
			...mockTimesheet,
			customerId: null,
		};
		const html = renderComponent(timesheetWithoutCustomer);
		expect(html).not.toContain('name="customerId"');
	});

	it("renders submit button with Generate Invoice text when active", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
		expect(html).toContain("Generate Invoice");
	});

	it("renders Invoice Generated text when inactive", () => {
		const inactiveTimesheet = {
			...mockTimesheet,
			active: false,
		};
		const html = renderComponent(inactiveTimesheet);
		expect(html).toContain("Invoice Generated");
	});

	it("disables button when timesheet is inactive", () => {
		const inactiveTimesheet = {
			...mockTimesheet,
			active: false,
		};
		const html = renderComponent(inactiveTimesheet);
		expect(html).toContain("disabled");
	});

	it("disables button when there are no entries", () => {
		const emptyTimesheet = {
			...mockTimesheet,
			entries: [],
		};
		const html = renderComponent(emptyTimesheet);
		expect(html).toContain("disabled");
	});

	it("enables button when timesheet is active and has entries", () => {
		const html = renderComponent();
		expect(html).not.toContain("disabled");
	});
});
