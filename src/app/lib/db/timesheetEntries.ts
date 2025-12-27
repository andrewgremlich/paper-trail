import { getDb } from "./client";

export const createTimesheetEntry = async (
	formData: FormData,
): Promise<void> => {
	try {
		const db = await getDb();
		const timesheetId = String(formData.get("timesheetId") || "");
		const projectRate = Number(formData.get("projectRate") || 0);
		const dateRaw = String(formData.get("date") || "");
		const dateObj = new Date(dateRaw);
		const date = dateObj.toISOString().split("T")[0];

		let minutes = Number(formData.get("minutes"));

		if (Number.isNaN(minutes) || minutes === 0) {
			const hours = Number(formData.get("hours") || 0);
			minutes = hours * 60;
		}

		const description = String(formData.get("description") || "").trim();

		const amount = (Math.max(0, projectRate) * Math.max(0, minutes)) / 60;

		await db.execute(
			`INSERT INTO timesheet_entries (timesheetId, date, minutes, description, amount)
		 VALUES ($1, $2, $3, $4, $5)`,
			[timesheetId, date, minutes, description, Math.round(amount)],
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
