import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModal } from ".";

// Mock the store
vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		projectModalActive: true,
		toggleProjectModal: vi.fn(),
		toggleTimesheetModal: vi.fn(),
		activeProjectId: 1,
	}),
}));

// Mock the database functions
vi.mock("@/lib/db", async () => {
	const actual = await vi.importActual("@/lib/db");
	return {
		...actual,
		getProjectById: vi.fn(),
		deleteProject: vi.fn(),
	};
});

// Mock child components that have complex dependencies
vi.mock("@/components/features/timesheets/GenerateTimesheet", () => ({
	GenerateTimesheet: () => <div data-testid="generate-timesheet" />,
}));

vi.mock("../ProjectEditForm", () => ({
	ProjectEditForm: () => <div data-testid="project-edit-form" />,
}));

describe("ProjectModal", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = () =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<ProjectModal />
			</QueryClientProvider>,
		);

	it("renders Dialog component", () => {
		const html = renderComponent();
		expect(html).toContain("<dialog");
		expect(html).toContain("</dialog>");
	});

	it("renders with liquidGlass variant", () => {
		const html = renderComponent();
		expect(html).toContain('data-variant="liquidGlass"');
	});

	it("renders dialog with proper structure", () => {
		const html = renderComponent();
		expect(html).toContain("dialog");
	});

	it("renders project details grid", () => {
		const html = renderComponent();
		expect(html).toContain("Rate:");
		expect(html).toContain("Active:");
	});
});
