import { api } from "./client";
import type { CreateTimesheetEntry, UpdateTimesheetEntry } from "./types";

export const createTimesheetEntry = async ({
	minutes,
	description,
	date,
	timesheetId,
	amount: amountInCents,
}: CreateTimesheetEntry): Promise<void> => {
	await api.post("/timesheet-entries", {
		timesheetId,
		date,
		minutes,
		description,
		amount: amountInCents,
	});
};

export const deleteTimesheetEntry = async (id: number): Promise<void> => {
	await api.delete(`/timesheet-entries/${id}`);
};

export const updateTimesheetEntry = async ({
	id,
	date,
	minutes,
	description,
	amount: amountInCents,
}: UpdateTimesheetEntry): Promise<void> => {
	await api.put(`/timesheet-entries/${id}`, {
		date,
		minutes,
		description,
		amount: amountInCents,
	});
};
