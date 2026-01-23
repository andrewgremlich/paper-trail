import { getDb } from "./client";
import type { CreateTimesheetEntry, UpdateTimesheetEntry } from "./types";

export const createTimesheetEntry = async ({
	minutes,
	description,
	date,
	timesheetId,
	amount: amountInCents,
}: CreateTimesheetEntry): Promise<void> => {
	try {
		const db = await getDb();

		await db.execute(
			`INSERT INTO timesheet_entries (timesheetId, date, minutes, description, amount)
			 VALUES ($1, $2, $3, $4, $5)`,
			[timesheetId, date, minutes, description, amountInCents],
		);
	} catch (err) {
		console.error(err);
		throw err;
	}
};

export const deleteTimesheetEntry = async (id: number): Promise<void> => {
	const db = await getDb();
	await db.execute(`DELETE FROM timesheet_entries WHERE id = $1`, [id]);
};

export const updateTimesheetEntry = async ({
	id,
	date,
	minutes,
	description,
	amount: amountInCents,
}: UpdateTimesheetEntry): Promise<void> => {
	try {
		const db = await getDb();

		await db.execute(
			`UPDATE timesheet_entries
			 SET date = $1, minutes = $2, description = $3, amount = $4
			 WHERE id = $5`,
			[date, minutes, description, amountInCents, id],
		);
	} catch (err) {
		console.error(err);
		throw err;
	}
};
