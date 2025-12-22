import {
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { H1 } from "./components/HtmlElements";
import { defaultColumns } from "./lib/accounting/tableColumns";
import type { Transaction } from "./lib/accounting/types";
import { upsertAccountingTransaction } from "./lib/db";
import {
	openAttachment,
	removeAttachment,
	saveAttachment,
} from "./lib/fileStorage";

export const Accounting = () => {
	const [data, setData] = useState<Transaction[]>([
		{
			id: crypto.randomUUID(),
			date: "2024-01-01",
			description: "Sample transaction",
			account: 1,
			category: "Office Supplies",
			amount: 99.99,
			file: null,
			filePath: null,
		},
	]);

	const table = useReactTable({
		columns: defaultColumns,
		data,
		getCoreRowModel: getCoreRowModel(),
		meta: {
			onAttach: async (rowIndex: number, file: File) => {
				const relPath = await saveAttachment(file);
				setData((prev) => {
					const updated = prev.map((t, i) =>
						i === rowIndex ? { ...t, file: null, filePath: relPath } : t,
					);
					const tx = updated[rowIndex];
					void upsertAccountingTransaction({
						id: tx.id,
						date: tx.date,
						description: tx.description,
						account: tx.account,
						category: tx.category,
						amount: tx.amount,
						filePath: tx.filePath ?? null,
					});
					return updated;
				});
			},
			onOpen: async (filePath: string) => {
				await openAttachment(filePath);
			},
			onRemove: async (rowIndex: number, filePath: string) => {
				await removeAttachment(filePath);
				setData((prev) => {
					const updated = prev.map((t, i) =>
						i === rowIndex ? { ...t, filePath: null } : t,
					);
					const tx = updated[rowIndex];
					void upsertAccountingTransaction({
						id: tx.id,
						date: tx.date,
						description: tx.description,
						account: tx.account,
						category: tx.category,
						amount: tx.amount,
						filePath: null,
					});
					return updated;
				});
			},
		},
	});

	return (
		<>
			<H1>Accounting</H1>
			<div className="overflow-x-auto">
				<table className="min-w-full border-collapse border border-gray-300">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} className="bg-gray-50">
								{headerGroup.headers.map((header) => (
									<th
										key={header.id}
										className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-900"
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => (
							<tr key={row.id} className="hover:bg-gray-50">
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										className="border border-gray-300 px-4 py-2 text-gray-700"
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
};
