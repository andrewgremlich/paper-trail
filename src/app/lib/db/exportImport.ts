import { api } from "./client";
import type { ExportData } from "./types";

export const exportAllData = async (): Promise<ExportData> => {
	return api.get<ExportData>("/export/data");
};

export const importAllData = async (data: ExportData): Promise<void> => {
	await api.post("/import/data", data);
};

export const validateImportData = (data: unknown): data is ExportData => {
	if (typeof data !== "object" || data === null) {
		return false;
	}

	const obj = data as Record<string, unknown>;

	return (
		typeof obj.version === "string" &&
		typeof obj.exportDate === "string" &&
		Array.isArray(obj.projects) &&
		Array.isArray(obj.timesheets) &&
		Array.isArray(obj.timesheetEntries) &&
		Array.isArray(obj.transactions)
	);
};
