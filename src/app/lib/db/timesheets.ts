import { getDb } from "./client";
import type {
	Nullable,
	Timesheet,
	TimesheetDetails,
	TimesheetEntry,
	TimesheetWithProject,
} from "./types";

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	const db = await getDb();

	const rows = await db.select<Timesheet[]>(
		`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt
		 FROM timesheets
		 ORDER BY createdAt DESC`,
	);

	return rows.map((r: Timesheet) => ({ ...r, closed: !!r.closed }));
};

export const getTimesheetById = async (
	timesheetId: number,
): Promise<TimesheetDetails | null> => {
	const db = await getDb();
	const headerRows = await db.select<TimesheetWithProject[]>(
		`SELECT t.id, t.projectId, t.invoiceId, t.name, t.description, t.closed, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate as projectRate
		 FROM timesheets t
		 JOIN projects p ON p.id = t.projectId
		 WHERE t.id = $1`,
		[timesheetId],
	);
	const header = headerRows[0];

	if (!header) return null;

	const rows = await db.select<TimesheetEntry[]>(
		`SELECT id, timesheetId, date, minutes, description, amount, createdAt, updatedAt
		FROM timesheet_entries WHERE timesheetId = $1 ORDER BY date ASC, createdAt ASC`,
		[timesheetId],
	);

	const details: TimesheetDetails = {
		id: header.id,
		projectId: header.projectId,
		invoiceId: header.invoiceId,
		name: header.name,
		description: header.description,
		closed: !!header.closed,
		createdAt: header.createdAt,
		updatedAt: header.updatedAt,
		customerId: header.customerId,
		projectRate: header.projectRate,
		entries: rows,
	};

	return details;
};

export const generateTimesheet = async (
	formData: FormData,
): Promise<Timesheet> => {
	const db = await getDb();
	const id = crypto.randomUUID();
	const projectId = String(formData.get("projectId") || "").trim();
	const name = String(formData.get("name") || "").trim();
	const description = (formData.get("description") || "") as Nullable<string>;

	await db.execute(
		`INSERT INTO timesheets (id, projectId, name, description, closed)
		 VALUES ($1, $2, $3, $4, 0)`,
		[id, projectId, name, description || null],
	);

	const row = (
		await db.select<
			Array<
				Omit<Timesheet, "closed"> & {
					closed: number | boolean;
				}
			>
		>(
			`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt FROM timesheets WHERE id = $1`,
			[id],
		)
	)[0];

	return { ...row, closed: !!row.closed };
};

export const deleteTimesheet = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");
	await db.execute(`DELETE FROM timesheets WHERE id = $1`, [id]);
};
