import { documentDir, join } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	mkdir,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Transaction } from "../db/types";

const ensureExportDir = async () => {
	const exportDir = "paper-trail/exports";
	const hasDir = await exists(exportDir, { baseDir: BaseDirectory.Document });

	if (!hasDir) {
		await mkdir(exportDir, {
			baseDir: BaseDirectory.Document,
			recursive: true,
		});
	}

	return exportDir;
};

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

export const exportTransactionsAsCsv = async (
	transactions: Transaction[],
	projectName: string,
) => {
	const exportDir = await ensureExportDir();
	const header = "Date,Project,Description,Amount";
	const rows = transactions.map((tx) => transactionToCsvRow(tx, projectName));
	const csv = [header, ...rows].join("\n");

	const fileName = `transactions-${projectName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
	const relPath = `${exportDir}/${fileName}`;

	await writeTextFile(relPath, csv, { baseDir: BaseDirectory.Document });

	const docDir = await documentDir();
	const absPath = await join(docDir, relPath);

	return { filePath: absPath, fileName };
};

export const exportTransactionsAsJson = async (
	transactions: Transaction[],
	projectName: string,
) => {
	const exportDir = await ensureExportDir();
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
	const relPath = `${exportDir}/${fileName}`;

	await writeTextFile(relPath, JSON.stringify(data, null, 2), {
		baseDir: BaseDirectory.Document,
	});

	const docDir = await documentDir();
	const absPath = await join(docDir, relPath);

	return { filePath: absPath, fileName };
};
