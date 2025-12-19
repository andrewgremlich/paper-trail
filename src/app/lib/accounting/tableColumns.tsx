import type { ColumnDef } from "@tanstack/react-table";
import type { Transaction } from "./types";

type TableMeta = {
	onAttach?: (rowIndex: number, file: File) => Promise<void> | void;
	onOpen?: (filePath: string) => Promise<void> | void;
	onRemove?: (rowIndex: number, filePath: string) => Promise<void> | void;
};

export const defaultColumns: ColumnDef<Transaction>[] = [
	{
		accessorKey: "date",
		header: "Date",
		cell: ({ getValue }) => {
			const v = String(getValue() ?? "");
			return v || "—";
		},
	},
	{
		accessorKey: "description",
		header: "Description",
		cell: ({ getValue }) => String(getValue() ?? ""),
	},
	{
		accessorKey: "account",
		header: "Account",
		cell: ({ getValue }) => String(getValue() ?? ""),
	},
	{
		accessorKey: "category",
		header: "Category",
		cell: ({ getValue }) => String(getValue() ?? ""),
	},
	{
		accessorKey: "amount",
		header: "Amount ($)",
		cell: ({ getValue }) => {
			const n = Number(getValue() ?? 0);
			return `$${n.toFixed(2)}`;
		},
	},
	{
		accessorKey: "file",
		header: "File",
		cell: ({ row, table }) => {
			const meta = (table.options.meta ?? {}) as TableMeta;
			const fileName =
				row.original.file?.name ||
				row.original.filePath?.split("/").pop() ||
				"";

			const inputId = `file-input-${row.id}`;
			const hasFile = !!fileName;

			return (
				<div className="flex items-center gap-2">
					<label
						htmlFor={inputId}
						className="cursor-pointer px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
					>
						{hasFile ? "Replace" : "Attach"}
					</label>
					<input
						id={inputId}
						type="file"
						className="hidden"
						onChange={async (e) => {
							const files = e.currentTarget.files;
							const f = files?.[0];
							if (f && meta.onAttach) {
								await meta.onAttach(row.index, f);
								e.currentTarget.value = "";
							}
						}}
					/>
					<span className="text-sm text-gray-700 truncate max-w-50">
						{hasFile ? fileName : "—"}
					</span>
					{row.original.filePath && (
						<>
							<button
								type="button"
								className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm"
								onClick={async () => {
									if (meta.onOpen && row.original.filePath) {
										await meta.onOpen(row.original.filePath);
									}
								}}
							>
								Open
							</button>
							<button
								type="button"
								className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
								onClick={async () => {
									if (meta.onRemove && row.original.filePath) {
										await meta.onRemove(row.index, row.original.filePath);
									}
								}}
							>
								Remove
							</button>
						</>
					)}
				</div>
			);
		},
	},
];
