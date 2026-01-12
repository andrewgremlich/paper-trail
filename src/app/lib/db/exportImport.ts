import { getDb } from "./client";
import type { ExportData, Project, Timesheet, TimesheetEntry, Transaction } from "./types";

/**
 * Exports all data from the database to a JSON-serializable object
 */
export const exportAllData = async (): Promise<ExportData> => {
	const db = await getDb();

	// Fetch all projects
	const projects = await db.select<Project[]>(
		`SELECT id, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
		 FROM projects
		 ORDER BY id ASC`,
	);

	// Fetch all timesheets
	const timesheets = await db.select<Timesheet[]>(
		`SELECT id, projectId, invoiceId, name, description, active, createdAt, updatedAt
		 FROM timesheets
		 ORDER BY id ASC`,
	);

	// Fetch all timesheet entries
	const timesheetEntries = await db.select<TimesheetEntry[]>(
		`SELECT id, timesheetId, date, minutes, description, amount, createdAt, updatedAt
		 FROM timesheet_entries
		 ORDER BY id ASC`,
	);

	// Fetch all transactions
	const transactions = await db.select<Transaction[]>(
		`SELECT id, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions
		 ORDER BY id ASC`,
	);

	return {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		projects,
		timesheets,
		timesheetEntries,
		transactions,
	};
};

/**
 * Imports data from an ExportData object into the database
 * This will REPLACE all existing data
 */
export const importAllData = async (data: ExportData): Promise<void> => {
	const db = await getDb();

	try {
		// Start a transaction for data integrity
		await db.execute("BEGIN TRANSACTION");

		// Delete existing data in reverse order of dependencies
		await db.execute("DELETE FROM timesheet_entries");
		await db.execute("DELETE FROM transactions");
		await db.execute("DELETE FROM timesheets");
		await db.execute("DELETE FROM projects");

		// Insert projects
		for (const project of data.projects) {
			await db.execute(
				`INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					project.id,
					project.name,
					project.active ? 1 : 0,
					project.customerId,
					project.rate_in_cents,
					project.description,
					project.createdAt,
					project.updatedAt,
				],
			);
		}

		// Insert timesheets
		for (const timesheet of data.timesheets) {
			await db.execute(
				`INSERT INTO timesheets (id, projectId, invoiceId, name, description, active, createdAt, updatedAt)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					timesheet.id,
					timesheet.projectId,
					timesheet.invoiceId,
					timesheet.name,
					timesheet.description,
					timesheet.active ? 1 : 0,
					timesheet.createdAt,
					timesheet.updatedAt,
				],
			);
		}

		// Insert timesheet entries
		for (const entry of data.timesheetEntries) {
			await db.execute(
				`INSERT INTO timesheet_entries (id, timesheetId, date, minutes, description, amount, createdAt, updatedAt)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					entry.id,
					entry.timesheetId,
					entry.date,
					entry.minutes,
					entry.description,
					entry.amount,
					entry.createdAt,
					entry.updatedAt,
				],
			);
		}

		// Insert transactions
		for (const transaction of data.transactions) {
			await db.execute(
				`INSERT INTO transactions (id, projectId, date, description, amount, filePath, createdAt, updatedAt)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					transaction.id,
					transaction.projectId,
					transaction.date,
					transaction.description,
					transaction.amount,
					transaction.filePath,
					transaction.createdAt,
					transaction.updatedAt,
				],
			);
		}

		// Commit the transaction
		await db.execute("COMMIT");
	} catch (error) {
		// Rollback on error
		await db.execute("ROLLBACK");
		throw error;
	}
};

/**
 * Validates that the imported data has the correct structure
 */
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
