import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionEditRow } from "./index";

describe("TransactionEditRow", () => {
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

	const mockOnSave = vi.fn();
	const mockOnCancel = vi.fn();

	it("renders date input with transaction date", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionEditRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onSave={mockOnSave}
							onCancel={mockOnCancel}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain('type="date"');
		expect(html).toContain('value="2024-01-15"');
	});

	it("renders description input with transaction description", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionEditRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onSave={mockOnSave}
							onCancel={mockOnCancel}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain('type="text"');
		expect(html).toContain('value="Test transaction"');
	});

	it("renders amount input with formatted amount", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionEditRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onSave={mockOnSave}
							onCancel={mockOnCancel}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain('type="number"');
		expect(html).toContain('value="100.50"');
	});

	it('renders "No File" when path is empty', () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionEditRow
							tx={mockTransaction}
							projects={mockProjects}
							path=""
							onSave={mockOnSave}
							onCancel={mockOnCancel}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("No File");
	});

	it('renders "View File" button when path is provided', () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<tr>
						<TransactionEditRow
							tx={mockTransaction}
							projects={mockProjects}
							path="/path/to/file.pdf"
							onSave={mockOnSave}
							onCancel={mockOnCancel}
						/>
					</tr>
				</tbody>
			</table>,
		);
		expect(html).toContain("View File");
	});
});
