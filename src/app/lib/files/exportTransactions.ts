import type { Transaction } from "../db/types";

const transactionToCsvRow = (tx: Transaction, projectName: string): string => {
	const escaped = (val: string) =>
		val.includes(",") || val.includes('"') || val.includes("\n")
			? `"${val.replace(/"/g, '""')}"`
			: val;

	return [
		escaped(tx.date),
		escaped(projectName),
		escaped(tx.description),
		tx.amount.toFixed(2),
	].join(",");
};

function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
}

export const exportTransactionsAsCsv = async (
	transactions: Transaction[],
	projectName: string,
) => {
	const header = "Date,Project,Description,Amount";
	const rows = transactions.map((tx) => transactionToCsvRow(tx, projectName));
	const csv = [header, ...rows].join("\n");

	const fileName = `transactions-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
	const blob = new Blob([csv], { type: "text/csv" });
	downloadBlob(blob, fileName);

	return { filePath: fileName, fileName };
};

export const exportTransactionsAsJson = async (
	transactions: Transaction[],
	projectName: string,
) => {
	const data = {
		project: projectName,
		exportedAt: new Date().toISOString(),
		transactions: transactions.map((tx) => ({
			date: tx.date,
			description: tx.description,
			amount: tx.amount,
		})),
	};

	const fileName = `transactions-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.json`;
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	downloadBlob(blob, fileName);

	return { filePath: fileName, fileName };
};
