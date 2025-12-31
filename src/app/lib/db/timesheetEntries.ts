import { getDb } from "./client";
import { normalizeDateInput } from "./utils";

export const createTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	try {
		const db = await getDb();
		const timesheetId = String(formData.get("timesheetId") || "");
		const projectRate = Number(formData.get("projectRate") || 0);
		const dateRaw = String(formData.get("date") || "");
		const date = normalizeDateInput(dateRaw);

		const hours = Number(formData.get("hours") || 0);
		const minutes = Math.max(0, hours) * 60;

		const description = String(formData.get("description") || "").trim();

		// Calculate in dollars then store as integer cents
		const amountDollars =
			(Math.max(0, projectRate) * Math.max(0, minutes)) / 60;
		const amountInCents = Math.round(amountDollars * 100);

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

export const deleteTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute(`DELETE FROM timesheet_entries WHERE id = $1`, [id]);
};

export const updateTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	try {
		const db = await getDb();
		const id = String(formData.get("id") || "");
		const projectRate = Number(formData.get("projectRate") || 0);
		const dateRaw = String(formData.get("date") || "");
		const date = normalizeDateInput(dateRaw);

		const hours = Number(formData.get("hours") || 0);
		const minutes = Math.max(0, hours) * 60;

		const description = String(formData.get("description") || "").trim();

		// Recalculate in dollars then store as integer cents
		const amountDollars = (Math.max(0, projectRate) * Math.max(0, minutes)) / 60;
		const amountInCents = Math.round(amountDollars * 100);

		await db.execute(
			`UPDATE timesheet_entries
			 SET date = $2, minutes = $3, description = $4, amount = $5
			 WHERE id = $1`,
			[id, date, minutes, description, amountInCents],
		);
	} catch (err) {
		console.error(err);
		throw err;
	}
};
