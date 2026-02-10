import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenerateTimesheet } from ".";

describe("GenerateTimesheet", () => {
	const queryClient = new QueryClient();
	const mockProject = {
		id: 1,
		userId: 1,
		name: "Test Project",
		description: "Test Description",
		rate_in_cents: 5000,
		customerId: "cus_123",
		active: true,
		timesheets: [],
		createdAt: 1704067200000,
		updatedAt: 1704067200000,
	};

	const renderComponent = (project = mockProject) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<GenerateTimesheet project={project} />
			</QueryClientProvider>,
		);

	it("renders section element", () => {
		const html = renderComponent();
		expect(html).toContain("<section");
		expect(html).toContain("</section>");
	});

	it("renders heading with project name", () => {
		const html = renderComponent();
		expect(html).toContain("Generate Timesheet for Test Project");
	});

	it("renders form element", () => {
		const html = renderComponent();
		expect(html).toContain("<form");
		expect(html).toContain("</form>");
	});

	it("renders hidden input for projectId", () => {
		const html = renderComponent();
		expect(html).toContain('name="projectId"');
		expect(html).toContain('value="1"');
	});

	it("renders timesheet name input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain("Timesheet Name");
	});

	it("renders description input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain("Timesheet Description");
	});

	it("renders autogen name button", () => {
		const html = renderComponent();
		expect(html).toContain("Autogen Name");
	});

	it("renders submit button", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
		expect(html).toContain("Generate Timesheet");
	});

	it("marks name input as required", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain('required=""');
	});
});
