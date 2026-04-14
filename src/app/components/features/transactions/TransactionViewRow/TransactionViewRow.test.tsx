import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionViewRow } from "./index";

vi.mock("@/lib/files/fileStorage", () => ({
	checkFileLink: vi.fn().mockResolvedValue(true),
	openAttachment: vi.fn(),
	saveAttachment: vi.fn(),
}));

const makeQueryClient = () =>
	new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("TransactionViewRow", () => {
	const mockTransaction: Transaction = {
		id: 1,
		userId: 1,
		date: "2024-01-15",
		description: "Test transaction",
		projectId: 1,
		amount: 100.5,
		filePath: "",
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	const mockProjects = [
		{
			id: 1,
			userId: 1,
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
			userId: 1,
			name: "Project 2",
			active: true,
			customerId: null,
			rate_in_cents: 15000,
			description: null,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
	];

	const mockOnEdit = vi.fn();
	const mockOnDelete = vi.fn();
	const mockOnReplaceFile = vi.fn();

	const renderRow = (path: string, tx = mockTransaction) =>
		renderToStaticMarkup(
			<QueryClientProvider client={makeQueryClient()}>
				<table>
					<tbody>
						<tr>
							<TransactionViewRow
								tx={tx}
								projects={mockProjects}
								path={path}
								onEdit={mockOnEdit}
								onDelete={mockOnDelete}
								onReplaceFile={mockOnReplaceFile}
							/>
						</tr>
					</tbody>
				</table>
			</QueryClientProvider>,
		);

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

	it('renders "No File" when path is empty', () => {
		expect(renderRow("")).toContain("No File");
	});

	it("renders delete button with hidden input", () => {
		const html = renderRow("");
		expect(html).toContain('type="hidden"');
		expect(html).toContain('value="1"');
		expect(html).toContain('aria-label="Delete Transaction"');
	});
});
