import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionList } from "./index";

vi.mock("@/lib/files/fileStorage", () => ({
	checkFileLink: vi.fn().mockResolvedValue(true),
	openAttachment: vi.fn(),
	saveAttachment: vi.fn(),
}));

vi.mock("../TransactionDialog", () => ({
	TransactionDialog: () => null,
}));

const makeQueryClient = () =>
	new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("TransactionList", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

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

	const mockOnSave = vi.fn();
	const mockOnDelete = vi.fn();
	const mockOnReplaceFile = vi.fn();

	const renderList = (transactions: Transaction[]) => {
		act(() => {
			createRoot(container).render(
				<QueryClientProvider client={makeQueryClient()}>
					<TransactionList
						transactions={transactions}
						projects={mockProjects}
						onSave={mockOnSave}
						onDelete={mockOnDelete}
						onReplaceFile={mockOnReplaceFile}
					/>
				</QueryClientProvider>,
			);
		});
		return container.innerHTML;
	};

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

	it("renders edit buttons for each transaction row", () => {
		const html = renderList(mockTransactions);
		expect(html).toContain('aria-label="Edit Transaction"');
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
