import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimesheetDetails } from "@/lib/db";
import { GenerateInvoice } from ".";

describe("GenerateInvoice", () => {
	const queryClient = new QueryClient();
	const mockTimesheet: TimesheetDetails = {
		id: "ts-1",
		userId: 1,
		name: "Test Timesheet",
		description: "Test Description",
		projectId: "proj-1",
		customerId: "cust-42",
		projectRate: 5000,
		active: true,
		entries: [
			{
				id: "entry-1",
				userId: 1,
				timesheetId: "ts-1",
				date: "2024-01-01",
				minutes: 60,
				description: "Test work",
				amount: 5000,
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
			},
		],
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
	};

	const renderComponent = (
		timesheet = mockTimesheet,
		activeTimesheetId = "ts-1",
	) =>
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

	it("disables button when the project has no customer linked", () => {
		const noCustomer = {
			...mockTimesheet,
			customerId: null,
		};
		const html = renderComponent(noCustomer);
		expect(html).toContain("disabled");
		expect(html).toContain("Attach a customer");
	});

	it("enables button when timesheet is active and has entries and customer", () => {
		const html = renderComponent();
		expect(html).not.toContain("disabled");
	});
});
