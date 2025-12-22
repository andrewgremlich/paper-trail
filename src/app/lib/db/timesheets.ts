import { getDb } from "./client";
import type {
	Nullable,
	Timesheet,
	TimesheetDetails,
	TimesheetRecord,
} from "./types";

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	const db = await getDb();
	type TimesheetRow = {
		id: string;
		projectId: string;
		invoiceId: Nullable<string>;
		name: string;
		description: Nullable<string>;
		closed: number | boolean;
		createdAt: string;
		updatedAt: string;
	};

	const rows = await db.select<TimesheetRow[]>(
		`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt
		 FROM timesheets
		 ORDER BY createdAt DESC`,
	);

	return rows.map((r: TimesheetRow) => ({ ...r, closed: !!r.closed }));
};

export const getTimesheetById = async (
	timesheetId: string,
): Promise<TimesheetDetails | null> => {
	const db = await getDb();

	// Join to pull project-level info (customerId, rate)
	const headerRows = await db.select<
		Array<
			{
				id: string;
				projectId: string;
				invoiceId: Nullable<string>;
				name: string;
				description: Nullable<string>;
				closed: number | boolean;
				createdAt: string;
				updatedAt: string;
			} & { customerId: Nullable<string>; projectRate: Nullable<number> }
		>
	>(
		`SELECT t.id, t.projectId, t.invoiceId, t.name, t.description, t.closed, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate as projectRate
		 FROM timesheets t
		 JOIN projects p ON p.id = t.projectId
		 WHERE t.id = $1`,
		[timesheetId],
	);
	const header = headerRows[0];
	if (!header) return null;

	type RecordRow = {
		id: string;
		timesheetId: string;
		date: string;
		hours: number;
		description: string;
		amount: number;
		createdAt: string;
		updatedAt: string;
	};

	const rows = await db.select<RecordRow[]>(
		`SELECT id, timesheetId, date, hours, description, amount, createdAt, updatedAt
		 FROM timesheet_records WHERE timesheetId = $1 ORDER BY date ASC, createdAt ASC`,
		[timesheetId],
	);

	const rate = header.projectRate ?? 0;
	const records: TimesheetRecord[] = rows.map((r) => ({ ...r, rate }));

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
		records,
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
