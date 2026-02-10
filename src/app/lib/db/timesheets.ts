import { getDb } from "./client";
import type {
	CreateTimesheet,
	Timesheet,
	TimesheetDetails,
	TimesheetEntry,
	TimesheetWithProject,
} from "./types";
import { getCurrentUserId } from "./userProfile";

export const getAllTimesheets = async (): Promise<Timesheet[]> => {
	try {
		const db = await getDb();
		const userId = await getCurrentUserId();

		const rows = await db.select<Timesheet[]>(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
		 FROM timesheets
		 WHERE userId = $1
		 ORDER BY createdAt DESC`,
			[userId],
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
		const userId = await getCurrentUserId();
		const headerRows = await db.select<TimesheetWithProject[]>(
			`SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate_in_cents as projectRate
		 FROM timesheets t
		 JOIN projects p ON p.id = t.projectId
		 WHERE t.id = $1 AND t.userId = $2`,
			[timesheetId, userId],
		);
		const header = headerRows[0];

		if (!header) return null;

		const rows = await db.select<TimesheetEntry[]>(
			`SELECT id, userId, timesheetId, date, minutes, description, amount, createdAt, updatedAt
		FROM timesheet_entries WHERE timesheetId = $1 AND userId = $2 ORDER BY date ASC, createdAt ASC`,
			[timesheetId, userId],
		);

		// Convert amount from integer cents to dollars for UI
		const normalizedEntries = rows.map((e) => ({
			...e,
			amount: e.amount / 100,
		}));

		const details: TimesheetDetails = {
			id: header.id,
			userId: header.userId,
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
	const userId = await getCurrentUserId();

	const { lastInsertId } = await db.execute(
		`INSERT INTO timesheets (projectId, name, description, active, userId)
		 VALUES ($1, $2, $3, $4, $5)`,
		[projectId, name, description || null, 1, userId],
	);

	const row = (
		await db.select<
			Array<
				Omit<Timesheet, "active"> & {
					active: number | boolean;
				}
			>
		>(
			`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt FROM timesheets WHERE id = $1 AND userId = $2`,
			[lastInsertId, userId],
		)
	)[0];

	return { ...row, active: !!row.active };
};

export const deleteTimesheet = async (id: number): Promise<void> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	await db.execute(`DELETE FROM timesheets WHERE id = $1 AND userId = $2`, [
		id,
		userId,
	]);
};

export const getTimesheetByInvoiceId = async (
	invoiceId: string,
): Promise<TimesheetWithProject | null> => {
	try {
		const db = await getDb();
		const userId = await getCurrentUserId();
		const rows = await db.select<TimesheetWithProject[]>(
			`SELECT t.id, t.userId, t.projectId, t.invoiceId, t.name, t.description, t.active, t.createdAt, t.updatedAt,
						p.customerId as customerId, p.rate_in_cents as projectRate
			 FROM timesheets t
			 JOIN projects p ON p.id = t.projectId
			 WHERE t.invoiceId = $1 AND t.userId = $2`,
			[invoiceId, userId],
		);

		if (rows.length === 0) return null;

		return { ...rows[0], active: !!rows[0].active };
	} catch (error) {
		console.error("Error in getTimesheetByInvoiceId:", error);
		throw error;
	}
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
	const userId = await getCurrentUserId();

	try {
		if (id) {
			await db.execute(
				`UPDATE timesheets
				 SET name = $1, description = $2, active = $3, updatedAt = CURRENT_TIMESTAMP
				 WHERE id = $4 AND userId = $5`,
				[name, description, active ? 1 : 0, id, userId],
			);
			const updated = (
				await db.select<
					Array<Omit<Timesheet, "active"> & { active: number | boolean }>
				>(
					`SELECT id, userId, projectId, invoiceId, name, description, active, createdAt, updatedAt
					 FROM timesheets WHERE id = $1 AND userId = $2`,
					[id, userId],
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
