import { getDb } from "./client";
import type {
	ExportData,
	Project,
	Timesheet,
	TimesheetEntry,
	Transaction,
	UserProfile,
} from "./types";
import { getCurrentUserId } from "./userProfile";

/**
 * Exports all data from the database to a JSON-serializable object
 */
export const exportAllData = async (): Promise<ExportData> => {
	const db = await getDb();
	const userId = await getCurrentUserId();

	// Fetch all projects
	const projects = await db.select<Project[]>(
		`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
		 FROM projects
		 WHERE userId = $1
		 ORDER BY id ASC`,
		[userId],
	);

	// Fetch all timesheets
	const timesheets = await db.select<Timesheet[]>(
		`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
		 FROM timesheets
		 WHERE userId = $1
		 ORDER BY id ASC`,
		[userId],
	);

	// Fetch all timesheet entries
	const timesheetEntries = await db.select<TimesheetEntry[]>(
		`SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
		 FROM timesheet_entries
		 WHERE userId = $1
		 ORDER BY id ASC`,
		[userId],
	);

	// Fetch all transactions
	const transactions = await db.select<Transaction[]>(
		`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions
		 WHERE userId = $1
		 ORDER BY id ASC`,
		[userId],
	);

	// Fetch user profile
	const userProfileRows = await db.select<UserProfile[]>(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);

	return {
		version: "1.0.0",
		exportDate: new Date().toISOString(),
		projects,
		timesheets,
		timesheetEntries,
		transactions,
		userProfile: userProfileRows[0] ?? undefined,
	};
};

/**
 * Imports data from an ExportData object into the database
 * This will REPLACE all existing data for the current user
 */
export const importAllData = async (data: ExportData): Promise<void> => {
	console.log(data);
	const db = await getDb();
	const userId = await getCurrentUserId();

	// Delete existing data for this user in reverse order of dependencies
	await db.execute("DELETE FROM timesheet_entries WHERE userId = $1", [userId]);
	await db.execute("DELETE FROM transactions WHERE userId = $1", [userId]);
	await db.execute("DELETE FROM timesheets WHERE userId = $1", [userId]);
	await db.execute("DELETE FROM projects WHERE userId = $1", [userId]);

	// Insert projects
	for (const project of data.projects) {
		await db.execute(
			`INSERT INTO projects (id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt, userId)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				project.id,
				project.name,
				project.active ? 1 : 0,
				project.customerId,
				project.rate_in_cents,
				project.description,
				project.createdAt,
				project.updatedAt,
				userId,
			],
		);
	}

	// Insert timesheets
	for (const timesheet of data.timesheets) {
		await db.execute(
			`INSERT INTO timesheets (id, projectId, invoiceId, name, description, active, createdAt, updatedAt, userId)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				timesheet.id,
				timesheet.projectId,
				timesheet.invoiceId,
				timesheet.name,
				timesheet.description,
				timesheet.active ? 1 : 0,
				timesheet.createdAt,
				timesheet.updatedAt,
				userId,
			],
		);
	}

	// Insert timesheet entries
	for (const entry of data.timesheetEntries) {
		await db.execute(
			`INSERT INTO timesheet_entries (id, timesheetId, date, minutes, description, amount, createdAt, updatedAt, userId)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				entry.id,
				entry.timesheetId,
				entry.date,
				entry.minutes,
				entry.description,
				entry.amount,
				entry.createdAt,
				entry.updatedAt,
				userId,
			],
		);
	}

	// Import user profile (preserve local UUID, only import displayName and email)
	if (data.userProfile) {
		const existingProfile = await db.select<UserProfile[]>(
			"SELECT id FROM user_profile LIMIT 1",
		);

		if (existingProfile.length > 0) {
			await db.execute(
				"UPDATE user_profile SET displayName = $1, email = $2 WHERE id = $3",
				[
					data.userProfile.displayName,
					data.userProfile.email,
					existingProfile[0].id,
				],
			);
		} else {
			const uuid = crypto.randomUUID();
			await db.execute(
				"INSERT INTO user_profile (uuid, displayName, email) VALUES ($1, $2, $3)",
				[uuid, data.userProfile.displayName, data.userProfile.email],
			);
		}
	}

	// Insert transactions
	for (const transaction of data.transactions) {
		await db.execute(
			`INSERT INTO transactions (id, projectId, date, description, amount, filePath, createdAt, updatedAt, userId)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			[
				transaction.id,
				transaction.projectId,
				transaction.date,
				transaction.description,
				transaction.amount,
				transaction.filePath,
				transaction.createdAt,
				transaction.updatedAt,
				userId,
			],
		);
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
