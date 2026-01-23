import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionList } from "./index";

describe("TransactionList", () => {
	const mockTransactions: Transaction[] = [
		{
			id: 1,
			date: "2024-01-15",
			description: "Test transaction 1",
			projectId: 1,
			amount: 100.5,
			filePath: "",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
		{
			id: 2,
			date: "2024-01-16",
			description: "Test transaction 2",
			projectId: 1,
			amount: 200.0,
			filePath: "/path/to/file.pdf",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
	];

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
	];

	const mockOnEdit = vi.fn();
	const mockOnCancelEdit = vi.fn();
	const mockOnSave = vi.fn();
	const mockOnDelete = vi.fn();

	it("renders 'No transactions found' when transactions array is empty", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={[]}
				projects={mockProjects}
				editingId={null}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		expect(html).toContain("No transactions found.");
	});

	it("renders transaction rows", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={mockTransactions}
				projects={mockProjects}
				editingId={null}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		expect(html).toContain("Test transaction 1");
		expect(html).toContain("Test transaction 2");
	});

	it("renders total row with correct sum", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={mockTransactions}
				projects={mockProjects}
				editingId={null}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		expect(html).toContain("Total: $300.50");
	});

	it("renders edit row when editingId matches transaction", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={mockTransactions}
				projects={mockProjects}
				editingId={1}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		// Edit row has save form with specific id
		expect(html).toContain("tx-edit-form-1");
	});

	it("renders view row when not editing", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={mockTransactions}
				projects={mockProjects}
				editingId={null}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		expect(html).toContain('aria-label="Edit Transaction"');
		expect(html).toContain('aria-label="Delete Transaction"');
	});

	it("renders project names", () => {
		const html = renderToStaticMarkup(
			<TransactionList
				transactions={mockTransactions}
				projects={mockProjects}
				editingId={null}
				onEdit={mockOnEdit}
				onCancelEdit={mockOnCancelEdit}
				onSave={mockOnSave}
				onDelete={mockOnDelete}
			/>,
		);
		expect(html).toContain("Project 1");
	});
});
