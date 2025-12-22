import { getDb } from "./client";

export const createTimesheetRecord = async (
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
		`INSERT INTO timesheet_records (id, timesheetId, date, hours, description, amount)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[id, timesheetId, date, hours, description, amount],
	);
};

export const deleteTimesheetRecord = async (
	formData: FormData,
): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute(`DELETE FROM timesheet_records WHERE id = $1`, [id]);
};
