import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/lib/types";
import { GenerateProject } from ".";

// Mock the store
vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		addProject: vi.fn(),
		addTimesheet: vi.fn(),
	}),
}));

// Mock the database functions
vi.mock("@/lib/db", () => ({
	generateProject: vi.fn(),
}));

describe("GenerateProject", () => {
	const queryClient = new QueryClient();
	const mockCustomers: Customer[] = [
		{
			id: "cus_123",
			name: "Test Customer",
			email: "test@example.com",
		},
		{
			id: "cus_456",
			name: "Another Customer",
			email: "another@example.com",
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const renderComponent = (customers?: Customer[]) =>
		renderToStaticMarkup(
			<QueryClientProvider client={queryClient}>
				<GenerateProject customers={customers} />
			</QueryClientProvider>,
		);

	it("renders form element", () => {
		const html = renderComponent();
		expect(html).toContain("<form");
		expect(html).toContain("</form>");
	});

	it("renders project name input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain("Project Name");
		expect(html).toContain("Awesome Project");
	});

	it("renders rate input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="rate"');
		expect(html).toContain("Rate");
		expect(html).toContain('type="number"');
	});

	it("renders customer select with label", () => {
		const html = renderComponent(mockCustomers);
		expect(html).toContain('name="customerId"');
		expect(html).toContain("Customer");
	});

	it("renders description input with label", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain("Project Description");
	});

	it("renders submit button", () => {
		const html = renderComponent();
		expect(html).toContain('type="submit"');
		expect(html).toContain("Generate Project");
	});

	it("marks name input as required", () => {
		const html = renderComponent();
		expect(html).toContain('name="name"');
		expect(html).toContain('required=""');
	});

	it("marks rate input as required", () => {
		const html = renderComponent();
		expect(html).toContain('name="rate"');
		expect(html).toContain('required=""');
	});

	it("marks customer select as required", () => {
		const html = renderComponent();
		expect(html).toContain('name="customerId"');
		expect(html).toContain('required=""');
	});

	it("marks description input as required", () => {
		const html = renderComponent();
		expect(html).toContain('name="description"');
		expect(html).toContain('required=""');
	});

	it("renders default customer option", () => {
		const html = renderComponent(mockCustomers);
		expect(html).toContain("Select a customer");
	});

	it("renders customer options when provided", () => {
		const html = renderComponent(mockCustomers);
		expect(html).toContain("Test Customer");
		expect(html).toContain("test@example.com");
		expect(html).toContain("Another Customer");
		expect(html).toContain("another@example.com");
	});

	it("handles empty customer list", () => {
		const html = renderComponent([]);
		expect(html).toContain('name="customerId"');
		expect(html).toContain("Select a customer");
	});

	it("handles undefined customer list", () => {
		const html = renderComponent(undefined);
		expect(html).toContain('name="customerId"');
		expect(html).toContain("Select a customer");
	});
});
