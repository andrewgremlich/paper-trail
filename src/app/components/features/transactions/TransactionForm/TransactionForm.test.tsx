import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./index";

describe("TransactionForm", () => {
	const mockProjects = [
		{
			id: 1,
			name: "Project 1",
			active: true,
			customerId: null,
			rate_in_cents: 10000,
			description: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
		{
			id: 2,
			name: "Project 2",
			active: true,
			customerId: null,
			rate_in_cents: 15000,
			description: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
	];

	const mockOnProjectChange = vi.fn();
	const mockOnSubmit = vi.fn();

	it("renders date input with today's date as default", () => {
		const today = new Date().toISOString().split("T")[0];
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('type="date"');
		expect(html).toContain(`value="${today}"`);
	});

	it("renders description input", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('name="description"');
		expect(html).toContain('type="text"');
	});

	it("renders project select with options", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('name="projectId"');
		expect(html).toContain("Select Project");
		expect(html).toContain("Project 1");
		expect(html).toContain("Project 2");
	});

	it("renders amount input", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('name="amount"');
		expect(html).toContain('type="number"');
		expect(html).toContain('step="0.01"');
	});

	it("renders file input", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('name="file"');
		expect(html).toContain('type="file"');
	});

	it("renders submit button", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={1}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('type="submit"');
		expect(html).toContain("Add Transaction");
	});

	it("renders with null activeProjectId", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={mockProjects}
				activeProjectId={null}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain('name="projectId"');
	});

	it("renders with undefined projects", () => {
		const html = renderToStaticMarkup(
			<TransactionForm
				projects={undefined}
				activeProjectId={null}
				onProjectChange={mockOnProjectChange}
				onSubmit={mockOnSubmit}
			/>,
		);
		expect(html).toContain("Select Project");
	});
});
