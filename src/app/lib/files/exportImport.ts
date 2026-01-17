import { documentDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
	BaseDirectory,
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import {
	exportAllData,
	importAllData,
	validateImportData,
} from "../db/exportImport";

export const handleExportData = async () => {
	// Get all data from database
	const data = await exportAllData();

	// Ensure the paper-trail/exports directory exists
	const exportDir = "paper-trail/exports";
	const hasDir = await exists(exportDir, { baseDir: BaseDirectory.Document });

	if (!hasDir) {
		await mkdir(exportDir, {
			baseDir: BaseDirectory.Document,
			recursive: true,
		});
	}

	// Create filename with timestamp
	const fileName = `paper-trail-backup-${new Date().toISOString().split("T")[0]}.json`;
	const relPath = `${exportDir}/${fileName}`;

	// Write data to file
	await writeTextFile(relPath, JSON.stringify(data, null, 2), {
		baseDir: BaseDirectory.Document,
	});

	// Get absolute path for display
	const docDir = await documentDir();
	const absPath = await join(docDir, relPath);

	return {
		filePath: absPath,
		fileName,
	};
};

export const handleImportData = async () => {
	// Open file picker dialog
	const filePath = await open({
		multiple: false,
		filters: [
			{
				name: "JSON",
				extensions: ["json"],
			},
		],
	});

	if (!filePath) {
		throw new Error("Import cancelled");
	}

	// Read file content
	const fileContent = await readTextFile(filePath as string);
	const data = JSON.parse(fileContent);

	// Validate data structure
	if (!validateImportData(data)) {
		throw new Error(
			"Invalid backup file format. Please select a valid Paper Trail backup file.",
		);
	}

	// Confirm with user before replacing data
	const confirmed = window.confirm(
		"WARNING: This will replace ALL existing data with the imported data. This action cannot be undone. Continue?",
	);

	if (!confirmed) {
		throw new Error("Import cancelled by user");
	}

	// Import data
	await importAllData(data);

	return {
		projectsCount: data.projects.length,
		timesheetsCount: data.timesheets.length,
		entriesCount: data.timesheetEntries.length,
		transactionsCount: data.transactions.length,
	};
};
