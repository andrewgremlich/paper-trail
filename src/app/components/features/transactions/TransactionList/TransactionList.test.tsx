import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionList } from "./index";

vi.mock("@/lib/files/fileStorage", () => ({
	checkFileLink: vi.fn().mockResolvedValue(true),
	openAttachment: vi.fn(),
	saveAttachment: vi.fn(),
}));

const makeQueryClient = () =>
	new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("TransactionList", () => {
	const mockTransactions: Transaction[] = [
		{
			id: "tx-1",
			userId: 1,
			date: "2024-01-15",
			description: "Test transaction 1",
			projectId: "proj-1",
			amount: 100.5,
			filePath: "",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
		{
			id: "tx-2",
			userId: 1,
			date: "2024-01-16",
			description: "Test transaction 2",
			projectId: "proj-1",
			amount: 200.0,
			filePath: "/path/to/file.pdf",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	const mockProjects = [
		{
			id: "proj-1",
			userId: 1,
			name: "Project 1",
			active: true,
			customerId: null,
			rate_in_cents: 10000,
			description: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	const mockOnEdit = vi.fn();
	const mockOnCancelEdit = vi.fn();
	const mockOnSave = vi.fn();
	const mockOnDelete = vi.fn();
	const mockOnReplaceFile = vi.fn();

	const renderList = (
		transactions: Transaction[],
		editingId: string | null = null,
	) =>
		renderToStaticMarkup(
			<QueryClientProvider client={makeQueryClient()}>
				<TransactionList
					transactions={transactions}
					projects={mockProjects}
					editingId={editingId}
					onEdit={mockOnEdit}
					onCancelEdit={mockOnCancelEdit}
					onSave={mockOnSave}
					onDelete={mockOnDelete}
					onReplaceFile={mockOnReplaceFile}
				/>
			</QueryClientProvider>,
		);

	it("renders 'No transactions found' when transactions array is empty", () => {
		expect(renderList([])).toContain("No transactions found.");
	});

	it("renders transaction rows", () => {
		const html = renderList(mockTransactions);
		expect(html).toContain("Test transaction 1");
		expect(html).toContain("Test transaction 2");
	});

	it("renders total row with correct sum", () => {
		expect(renderList(mockTransactions)).toContain("Total: $300.50");
	});

	it("renders edit row when editingId matches transaction", () => {
		expect(renderList(mockTransactions, "tx-1")).toContain("tx-edit-form-tx-1");
	});

	it("renders view row when not editing", () => {
		const html = renderList(mockTransactions);
		expect(html).toContain('aria-label="Edit Transaction"');
		expect(html).toContain('aria-label="Delete Transaction"');
	});

	it("renders project names", () => {
		expect(renderList(mockTransactions)).toContain("Project 1");
	});
});
