import { api } from "./client";
import type {
	CreateTimesheet,
	Timesheet,
	TimesheetDetails,
	TimesheetWithProject,
} from "./types";

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	return api.get<Timesheet[]>("/timesheets");
};

export const getTimesheetById = async (
	timesheetId: string,
): Promise<TimesheetDetails | null> => {
	try {
		return await api.get<TimesheetDetails>(`/timesheets/${timesheetId}`);
	} catch {
		return null;
	}
};

export const generateTimesheet = async ({
	name,
	projectId,
	description,
}: CreateTimesheet): Promise<Timesheet> => {
	return api.post<Timesheet>("/timesheets", {
		projectId,
		name,
		description,
	});
};

export const deleteTimesheet = async (id: string): Promise<void> => {
	await api.delete(`/timesheets/${id}`);
};

export const getTimesheetByInvoiceId = async (
	invoiceId: string,
): Promise<TimesheetWithProject | null> => {
	try {
		return await api.get<TimesheetWithProject | null>(
			`/timesheets/by-invoice/${invoiceId}`,
		);
	} catch {
		return null;
	}
};

export const updateTimesheet = async ({
	id,
	name,
	description,
	closed,
}: Pick<
	Timesheet,
	"id" | "name" | "description" | "closed"
>): Promise<Timesheet | null> => {
	try {
		return await api.put<Timesheet>(`/timesheets/${id}`, {
			name,
			description,
			closed,
		});
	} catch (error) {
		console.error("Error in updateTimesheet:", error);
		return null;
	}
};
