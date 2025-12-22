import { getDb } from "./client";

export const createTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = crypto.randomUUID();
	const timesheetId = String(formData.get("timesheetId") || "");
	const projectRate = Number(formData.get("projectRate") || 0);
	const date = String(formData.get("date") || "");
	const hours = Number(formData.get("hours") || 0);
	const description = String(formData.get("description") || "").trim();

	const amount = Math.max(0, projectRate) * Math.max(0, hours);

	await db.execute(
		`INSERT INTO timesheet_entries (id, timesheetId, date, hours, description, amount)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[id, timesheetId, date, hours, description, amount],
	);
};

export const deleteTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute(`DELETE FROM timesheet_entries WHERE id = $1`, [id]);
};
