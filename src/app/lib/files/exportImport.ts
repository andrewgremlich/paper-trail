import {
	exportAllData,
	importAllData,
	validateImportData,
} from "../db/exportImport";

export const handleExportData = async () => {
	const data = await exportAllData();
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const fileName = `paper-trail-backup-${new Date().toISOString().split("T")[0]}.json`;

	const a = document.createElement("a");
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);

	return { filePath: fileName, fileName };
};

export const handleImportData = async () => {
	return new Promise<{
		projectsCount: number;
		timesheetsCount: number;
		entriesCount: number;
		transactionsCount: number;
	}>((resolve, reject) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				reject(new Error("Import cancelled"));
				return;
			}

			try {
				const text = await file.text();
				const data = JSON.parse(text);

				if (!validateImportData(data)) {
					reject(
						new Error(
							"Invalid backup file format. Please select a valid Paper Trail backup file.",
						),
					);
					return;
				}

				const confirmed = window.confirm(
					"WARNING: This will replace ALL existing data with the imported data. This action cannot be undone. Continue?",
				);

				if (!confirmed) {
					reject(new Error("Import cancelled by user"));
					return;
				}

				await importAllData(data);

				resolve({
					projectsCount: data.projects.length,
					timesheetsCount: data.timesheets.length,
					entriesCount: data.timesheetEntries.length,
					transactionsCount: data.transactions.length,
				});
			} catch (err) {
				reject(err);
			}
		};

		input.click();
	});
};
