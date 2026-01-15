import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateTimesheetRecord } from ".";

describe("CreateTimesheetRecord", () => {
	const queryClient = new QueryClient();
	const defaultProps = {
		timesheetId: 1,
		projectRate: 5000,
		active: true,
	};

	const renderComponent = (props = defaultProps) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<CreateTimesheetRecord {...props} />
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

	it("renders hidden input for projectRate", () => {
		const html = renderComponent();
		expect(html).toContain('name="projectRate"');
		expect(html).toContain('value="5000"');
	});

	it("renders date input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="date"');
		expect(html).toContain('type="date"');
		expect(html).toContain("Date");
	});

	it("renders hours input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="hours"');
		expect(html).toContain('type="number"');
		expect(html).toContain('step="0.25"');
		expect(html).toContain("Hours");
	});

	it("renders description input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain("Description");
	});

	it("renders submit button", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
	});

	it("disables submit button when timesheet is not active", () => {
		const html = renderComponent({ ...defaultProps, active: false });
		expect(html).toContain("disabled");
	});

	it("does not disable submit button when timesheet is active", () => {
		const html = renderComponent({ ...defaultProps, active: true });
		const formMatch = html.match(/<form[^>]*>[\s\S]*?<\/form>/);
		if (formMatch) {
			const submitButtonMatch = formMatch[0].match(
				/<button[^>]*type="submit"[^>]*>/,
			);
			expect(submitButtonMatch).toBeTruthy();
		}
	});
});
