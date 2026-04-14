import { api } from "./client";
import type { ExportData } from "./types";

export const exportAllData = async (encrypted = false): Promise<ExportData> => {
	return api.get<ExportData>(
		`/export/data${encrypted ? "?encrypted=true" : ""}`,
	);
};

export const exportZipData = async (): Promise<ArrayBuffer> => {
	const response = await fetch("/api/v1/export/zip", {
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(`Export failed: ${response.statusText}`);
	}
	return response.arrayBuffer();
};

export const importAllData = async (data: ExportData): Promise<void> => {
	await api.post("/import/data", data);
};

export const importZipData = async (
	zipBytes: ArrayBuffer,
): Promise<{
	projectsCount: number;
	timesheetsCount: number;
	entriesCount: number;
	transactionsCount: number;
}> => {
	const response = await fetch("/api/v1/import/zip", {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/zip" },
		body: zipBytes,
	});
	if (!response.ok) {
		const err = (await response.json()) as { error: string };
		throw new Error(err.error ?? `Import failed: ${response.statusText}`);
	}
	return response.json();
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
