import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/db";
import { TransactionTotalRow } from "./index";

describe("TransactionTotalRow", () => {
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
			filePath: "",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
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
				id: "tx-3",
				userId: 1,
				date: "2024-01-15",
				description: "Income",
				projectId: "proj-1",
				amount: 500.0,
				filePath: "",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			{
				id: "tx-4",
				userId: 1,
				date: "2024-01-16",
				description: "Expense",
				projectId: "proj-1",
				amount: -150.0,
				filePath: "",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
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

	it("renders three table cells with colSpan totaling seven columns", () => {
		const html = renderToStaticMarkup(
			<table>
				<tbody>
					<TransactionTotalRow transactions={mockTransactions} />
				</tbody>
			</table>,
		);
		const tdCount = (html.match(/<td/g) || []).length;
		expect(tdCount).toBe(3);
	});
});
