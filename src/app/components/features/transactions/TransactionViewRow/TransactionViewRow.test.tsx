import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionViewRow } from "./index";

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

	it("renders formatted transaction date", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("Jan 15, 2024");
	});

	it("renders transaction description", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("Test transaction");
	});

	it("renders project name", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("Project 1");
	});

	it("renders formatted amount", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("$100.50");
	});

	it('renders "No File" when path is empty', () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("No File");
	});

	it("renders delete button with hidden input", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionViewRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onEdit={mockOnEdit}
							onDelete={mockOnDelete}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain('type="hidden"');
		expect(html).toContain('value="1"');
		expect(html).toContain('aria-label="Delete Transaction"');
	});
});
