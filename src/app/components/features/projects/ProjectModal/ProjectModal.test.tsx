import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModal } from ".";

vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		projectModalActive: true,
		toggleProjectModal: vi.fn(),
		toggleTimesheetModal: vi.fn(),
		activeProjectId: 1,
	}),
}));

vi.mock("@/lib/db", async () => {
	const actual = await vi.importActual("@/lib/db");
	return {
		...actual,
		getProjectById: vi.fn(),
		deleteProject: vi.fn(),
	};
});

vi.mock("@/components/features/timesheets/GenerateTimesheet", () => ({
	GenerateTimesheet: () => <div data-testid="generate-timesheet" />,
}));

vi.mock("../ProjectEditForm", () => ({
	ProjectEditForm: () => <div data-testid="project-edit-form" />,
}));

describe("ProjectModal", () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		act(() => {
			createRoot(container).render(
				<QueryClientProvider client={queryClient}>
					<ProjectModal />
				</QueryClientProvider>,
			);
		});
		return document.body.innerHTML;
	};

	it("renders Dialog component", () => {
		const html = renderComponent();
		expect(html).toContain("<dialog");
		expect(html).toContain("</dialog>");
	});

	it("renders with solid variant", () => {
		const html = renderComponent();
		expect(html).toContain('data-variant="solid"');
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
