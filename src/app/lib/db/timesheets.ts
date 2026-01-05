import { getDb } from "./client";
import type {
	CreateTimesheet,
	Timesheet,
	TimesheetDetails,
	TimesheetEntry,
	TimesheetWithProject,
} from "./types";

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	try {
		const db = await getDb();

		const rows = await db.select<Timesheet[]>(
			`SELECT id, projectId, invoiceId, name, description, active, createdAt, updatedAt
		 FROM timesheets
		 ORDER BY createdAt DESC`,
		);

		return rows.map((r: Timesheet) => ({ ...r, active: !!r.active }));
	} catch (error) {
		console.error("Error in getAllTimesheets:", error);
		throw error;
	}
};

export const getTimesheetById = async (
	timesheetId: number,
): Promise<TimesheetDetails | null> => {
	try {
		const db = await getDb();
		const headerRows = await db.select<TimesheetWithProject[]>(
			`SELECT t.id, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate_in_cents as projectRate
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

		// Convert amount from integer cents to dollars for UI
		const normalizedEntries = rows.map((e) => ({
			...e,
			amount: e.amount / 100,
		}));

		const details: TimesheetDetails = {
			id: header.id,
			projectId: header.projectId,
			invoiceId: header.invoiceId,
			name: header.name,
			description: header.description,
			active: !!header.active,
			createdAt: header.createdAt,
			updatedAt: header.updatedAt,
			customerId: header.customerId,
			projectRate: header.projectRate,
			entries: normalizedEntries,
		};

		return details;
	} catch (error) {
		console.error("Error in getTimesheetById:", error);
		throw error;
	}
};

export const generateTimesheet = async ({
	name,
	projectId,
	description,
}: CreateTimesheet): Promise<Timesheet> => {
	const db = await getDb();

	const { lastInsertId } = await db.execute(
		`INSERT INTO timesheets (projectId, name, description, active)
		 VALUES ($1, $2, $3, $4)`,
		[projectId, name, description || null, 1],
	);

	const row = (
		await db.select<
			Array<
				Omit<Timesheet, "active"> & {
					active: number | boolean;
				}
			>
		>(
			`SELECT id, projectId, invoiceId, name, description, active, createdAt, updatedAt FROM timesheets WHERE id = $1`,
			[lastInsertId],
		)
	)[0];

	return { ...row, active: !!row.active };
};

export const deleteTimesheet = async (id: number): Promise<void> => {
	const db = await getDb();
	await db.execute(`DELETE FROM timesheets WHERE id = $1`, [id]);
};

export const updateTimesheet = async ({
	id,
	name,
	description,
	active,
}: Pick<
	Timesheet,
	"id" | "name" | "description" | "active"
>): Promise<Timesheet | null> => {
	const db = await getDb();

	try {
		if (id) {
			await db.execute(
				`UPDATE timesheets
				 SET name = $1, description = $2, active = $3, updatedAt = CURRENT_TIMESTAMP
				 WHERE id = $4`,
				[name, description, active ? 1 : 0, id],
			);
			const updated = (
				await db.select<
					Array<Omit<Timesheet, "active"> & { active: number | boolean }>
				>(
					`SELECT id, projectId, invoiceId, name, description, active, createdAt, updatedAt
					 FROM timesheets WHERE id = $1`,
					[id],
				)
			)[0];
			return { ...updated, active: !!updated.active } as Timesheet;
		}
		throw new Error("Timesheet ID is required for update");
	} catch (error) {
		console.error("Error in updateTimesheet:", error);
		return null;
	}
};
