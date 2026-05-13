import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionViewRow } from "./index";

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

describe("TransactionViewRow", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	const mockTransaction: Transaction = {
		id: "tx-1",
		userId: 1,
		date: "2024-01-15",
		description: "Test transaction",
		projectId: "proj-1",
		amount: 100.5,
		filePath: "",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

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
		{
			id: "proj-2",
			userId: 1,
			name: "Project 2",
			active: true,
			customerId: null,
			rate_in_cents: 15000,
			description: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		},
	];

	const mockOnDelete = vi.fn();
	const mockOnSave = vi.fn();
	const mockOnReplaceFile = vi.fn();

	const renderRow = (path: string, tx = mockTransaction) => {
		act(() => {
			createRoot(container).render(
				<QueryClientProvider client={makeQueryClient()}>
					<table>
						<tbody>
							<tr>
								<TransactionViewRow
									tx={tx}
									projects={mockProjects}
									path={path}
									onSave={mockOnSave}
									onDelete={mockOnDelete}
									onReplaceFile={mockOnReplaceFile}
								/>
							</tr>
						</tbody>
					</table>
				</QueryClientProvider>,
			);
		});
		return container.innerHTML;
	};

	it("renders formatted transaction date", () => {
		expect(renderRow("")).toContain("Jan 15, 2024");
	});

	it("renders transaction description", () => {
		expect(renderRow("")).toContain("Test transaction");
	});

	it("renders project name", () => {
		expect(renderRow("")).toContain("Project 1");
	});

	it("renders formatted amount", () => {
		expect(renderRow("")).toContain("$100.50");
	});

	it("renders upload button when path is empty", () => {
		expect(renderRow("")).toContain("Upload");
	});

	it("renders edit and delete buttons", () => {
		const html = renderRow("");
		expect(html).toContain('aria-label="Edit Transaction"');
		expect(html).toContain('aria-label="Delete Transaction"');
	});
});
