import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/db";
import { ProjectEditForm } from ".";

// Mock the database functions
vi.mock("@/lib/db", async () => {
	const actual = await vi.importActual("@/lib/db");
	return {
		...actual,
		updateProject: vi.fn(),
	};
});

describe("ProjectEditForm", () => {
	const queryClient = new QueryClient();
	const mockProject: Project = {
		id: 1,
		userId: 1,
		name: "Test Project",
		description: "Test Description",
		rate_in_cents: 5000,
		customerId: "cus_123",
		active: true,
		createdAt: 1704067200000,
		updatedAt: 1704067200000,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = (project = mockProject, onSaved?: () => void) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<ProjectEditForm project={project} onSaved={onSaved} />
			</QueryClientProvider>,
		);

	it("renders form element", () => {
		const html = renderComponent();
		expect(html).toContain("<form");
		expect(html).toContain("</form>");
	});

	it("renders name input with default value", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain("Name");
		expect(html).toContain('value="Test Project"');
	});

	it("renders description input with default value", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain("Description");
		expect(html).toContain('value="Test Description"');
	});

	it("renders rate input with default value converted from cents", () => {
		const html = renderComponent();
		expect(html).toContain('name="rate_in_cents"');
		expect(html).toContain("Rate (USD/hr)");
		expect(html).toContain('value="50"');
	});

	it("renders submit button", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
		expect(html).toContain("Save Changes");
	});

	it("handles project with null description", () => {
		const projectWithNullDescription = {
			...mockProject,
			description: null,
		};
		const html = renderComponent(projectWithNullDescription);
		expect(html).toContain('name="description"');
		expect(html).toContain('value=""');
	});

	it("handles project with null rate", () => {
		const projectWithNullRate = {
			...mockProject,
			rate_in_cents: null,
		};
		const html = renderComponent(projectWithNullRate);
		expect(html).toContain('name="rate_in_cents"');
		expect(html).toContain('value="0"');
	});

	it("handles project with zero rate", () => {
		const projectWithZeroRate = {
			...mockProject,
			rate_in_cents: 0,
		};
		const html = renderComponent(projectWithZeroRate);
		expect(html).toContain('value="0"');
	});

	it("renders all form inputs", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain('name="description"');
		expect(html).toContain('name="rate_in_cents"');
	});
});
