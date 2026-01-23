import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionTotalRow } from "./index";

describe("TransactionTotalRow", () => {
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
			filePath: "",
			createdAt: Date.now(),
			updatedAt: Date.now(),
		},
	];

	it("renders total with correct sum", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={mockTransactions} />
				</tbody>
			</table>,
		);
		expect(html).toContain("Total: $300.50");
	});

	it("renders total as $0.00 for empty transactions", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={[]} />
				</tbody>
			</table>,
		);
		expect(html).toContain("Total: $0.00");
	});

	it("handles single transaction", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={[mockTransactions[0]]} />
				</tbody>
			</table>,
		);
		expect(html).toContain("Total: $100.50");
	});

	it("handles negative amounts", () => {
		const transactionsWithNegative: Transaction[] = [
			{
				id: 1,
				date: "2024-01-15",
				description: "Income",
				projectId: 1,
				amount: 500.0,
				filePath: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
			{
				id: 2,
				date: "2024-01-16",
				description: "Expense",
				projectId: 1,
				amount: -150.0,
				filePath: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		];
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={transactionsWithNegative} />
				</tbody>
			</table>,
		);
		expect(html).toContain("Total: $350.00");
	});

	it("renders seven table cells", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={mockTransactions} />
				</tbody>
			</table>,
		);
		const tdCount = (html.match(/<td/g) || []).length;
		expect(tdCount).toBe(7);
	});
});
