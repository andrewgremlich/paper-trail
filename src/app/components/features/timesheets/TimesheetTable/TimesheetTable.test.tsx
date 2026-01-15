import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TimesheetTable } from ".";

// Mock the store
vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		activeTimesheetId: 1,
	}),
}));

// Mock database functions
vi.mock("@/lib/db", async () => {
	const actual = await vi.importActual("@/lib/db");
	return {
		...actual,
		deleteTimesheetEntry: vi.fn(),
		updateTimesheetEntry: vi.fn(),
	};
});

describe("TimesheetTable", () => {
	const queryClient = new QueryClient();
	const mockEntries = [
		{
			id: 1,
			date: "2024-01-15",
			minutes: 120,
			description: "Testing feature A",
			amount: 10000,
			timesheetId: 1,
			createdAt: 1705276800000,
			updatedAt: 1705276800000,
		},
		{
			id: 2,
			date: "2024-01-16",
			minutes: 60,
			description: "Testing feature B",
			amount: 5000,
			timesheetId: 1,
			createdAt: 1705363200000,
			updatedAt: 1705363200000,
		},
	];

	const defaultProps = {
		entries: mockEntries,
		active: true,
		projectRate: 5000,
	};

	const renderComponent = (props = defaultProps) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<TimesheetTable {...props} />
			</QueryClientProvider>,
		);

	it("renders table when entries exist", () => {
		const html = renderComponent();
		expect(html).toContain("<table");
		expect(html).toContain("</table>");
	});

	it("renders table headers", () => {
		const html = renderComponent();
		expect(html).toContain("Date");
		expect(html).toContain("Hours");
		expect(html).toContain("Description");
		expect(html).toContain("Amount ($)");
	});

	it("renders all entries", () => {
		const html = renderComponent();
		expect(html).toContain("Testing feature A");
		expect(html).toContain("Testing feature B");
	});

	it("displays formatted dates", () => {
		const html = renderComponent();
		expect(html).toContain("2024");
	});

	it("displays hours converted from minutes", () => {
		const html = renderComponent();
		expect(html).toContain("2"); // 120 minutes = 2 hours
		expect(html).toContain("1"); // 60 minutes = 1 hour
	});

	it("displays formatted amounts in dollars", () => {
		const html = renderComponent();
		expect(html).toContain("$100.00"); // 10000 cents
		expect(html).toContain("$50.00"); // 5000 cents
	});

	it("displays total amount", () => {
		const html = renderComponent();
		expect(html).toContain("Total Amount");
		expect(html).toContain("$150.00"); // 10000 + 5000 cents = 15000 cents = $150
	});

	it("renders empty state when no entries", () => {
		const html = renderComponent({ ...defaultProps, entries: [] });
		expect(html).not.toContain("<table");
		expect(html).toContain("No timesheet entries yet");
	});

	it("does not render total amount when no entries", () => {
		const html = renderComponent({ ...defaultProps, entries: [] });
		expect(html).not.toContain("Total Amount");
	});

	it("renders edit buttons for each entry", () => {
		const html = renderComponent();
		expect(html).toContain("svg"); // Edit icons
	});

	it("disables edit buttons when timesheet is not active", () => {
		const html = renderComponent({ ...defaultProps, active: false });
		expect(html).toContain("disabled");
	});
});
