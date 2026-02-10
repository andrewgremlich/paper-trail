import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimesheetEditForm } from ".";

describe("TimesheetEditForm", () => {
	const queryClient = new QueryClient();
	const mockTimesheet = {
		id: 1,
		userId: 1,
		name: "Test Timesheet",
		description: "Test Description",
		active: true,
		projectId: 1,
		projectRate: 5000,
		customerId: "cus_123",
		invoiceId: null,
		entries: [],
		createdAt: 1704067200000,
		updatedAt: 1704067200000,
	};

	const renderComponent = (timesheet = mockTimesheet, onSaved = () => {}) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<TimesheetEditForm timesheet={timesheet} onSaved={onSaved} />
			</QueryClientProvider>,
		);

	it("renders form element", () => {
		const html = renderComponent();
		expect(html).toContain("<form");
		expect(html).toContain("</form>");
	});

	it("renders name input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain("Name");
	});

	it("renders description input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain("Description");
	});

	it("populates name input with timesheet name", () => {
		const html = renderComponent();
		expect(html).toContain('value="Test Timesheet"');
	});

	it("populates description input with timesheet description", () => {
		const html = renderComponent();
		expect(html).toContain('value="Test Description"');
	});

	it("renders submit button", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
		expect(html).toContain("Save Changes");
	});

	it("handles empty description", () => {
		const timesheetWithoutDescription = {
			...mockTimesheet,
			description: "",
		};
		const html = renderComponent(timesheetWithoutDescription);
		expect(html).toContain('name="description"');
	});

	it("handles empty name", () => {
		const timesheetWithoutName = {
			...mockTimesheet,
			name: "",
		};
		const html = renderComponent(timesheetWithoutName);
		expect(html).toContain('name="name"');
		expect(html).toContain('value=""');
	});
});
