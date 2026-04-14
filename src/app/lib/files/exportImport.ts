import {
	exportAllData,
	exportZipData,
	importAllData,
	importZipData,
	validateImportData,
} from "../db/exportImport";

export const handleExportData = async (encrypted = false) => {
	if (encrypted) {
		// Encrypted export stays as JSON (files not included — they're already encrypted in R2)
		const data = await exportAllData(true);
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const fileName = `paper-trail-encrypted-${new Date().toISOString().split("T")[0]}.json`;
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(url);
		return { filePath: fileName, fileName };
	}

	// Plaintext export: ZIP with data.json + all uploaded files
	const zipBytes = await exportZipData();
	const blob = new Blob([zipBytes], { type: "application/zip" });
	const url = URL.createObjectURL(blob);
	const fileName = `paper-trail-backup-${new Date().toISOString().split("T")[0]}.zip`;

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
		input.accept = ".json,.zip";

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) {
				reject(new Error("Import cancelled"));
				return;
			}

			const confirmed = window.confirm(
				"WARNING: This will replace ALL existing data with the imported data. This action cannot be undone. Continue?",
			);

			if (!confirmed) {
				reject(new Error("Import cancelled by user"));
				return;
			}

			try {
				if (file.name.endsWith(".zip")) {
					const zipBytes = await file.arrayBuffer();
					const result = await importZipData(zipBytes);
					resolve(result);
				} else {
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

					await importAllData(data);

					resolve({
						projectsCount: data.projects.length,
						timesheetsCount: data.timesheets.length,
						entriesCount: data.timesheetEntries.length,
						transactionsCount: data.transactions.length,
					});
				}
			} catch (err) {
				reject(err);
			}
		};

		input.click();
	});
};
