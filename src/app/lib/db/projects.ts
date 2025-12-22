import { getDb } from "./client";
import type { MinimalTimesheet, Nullable, Project, Timesheet } from "./types";

export const getAllProjects = async (): Promise<Project[]> => {
	const db = await getDb();
	const rows = await db.select<Project[]>(
		`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt
		 FROM projects
		 ORDER BY createdAt DESC`,
	);
	return rows;
};

export type ProjectWithTimesheets = Project & {
	timesheets: MinimalTimesheet[];
};

export const getProjectById = async (
	projectId: string,
): Promise<ProjectWithTimesheets | null> => {
	const db = await getDb();
	const projects = await db.select<Project[]>(
		`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt
		 FROM projects WHERE id = $1`,
		[projectId],
	);
	const project = projects[0];
	if (!project) return null;

	const timesheets = await db.select<
		Array<MinimalTimesheet & { closed: number | boolean }>
	>(
		`SELECT id, name, description, closed, createdAt, updatedAt
		 FROM timesheets WHERE projectId = $1 ORDER BY createdAt DESC`,
		[projectId],
	);

	const normalized: MinimalTimesheet[] = timesheets.map((t) => ({
		...t,
		closed: !!t.closed,
	}));

	return { ...project, timesheets: normalized };
};

export const generateProject = async (
	formData: FormData,
): Promise<{ project: Project; timesheet: Timesheet }> => {
	const db = await getDb();
	const id = crypto.randomUUID();

	const name = String(formData.get("name") || "").trim();
	const rate = Number(formData.get("rate") || 0);
	const customerId = (formData.get("customerId") || "") as Nullable<string>;
	const description = (formData.get("description") || "") as Nullable<string>;

	await db.execute(
		`INSERT INTO projects (id, name, status, customerId, rate, description)
		 VALUES ($1, $2, 'active', $3, $4, $5)`,
		[
			id,
			name,
			customerId || null,
			Number.isFinite(rate) ? rate : null,
			description || null,
		],
	);

	const createdProject = (
		await db.select<Project[]>(
			`SELECT id, name, status, customerId, rate, description, createdAt, updatedAt FROM projects WHERE id = $1`,
			[id],
		)
	)[0];

	const tsId = crypto.randomUUID();
	const tsName = `${new Date().toLocaleDateString()} Timesheet`;
	const tsDesc = "Initial timesheet";
	await db.execute(
		`INSERT INTO timesheets (id, projectId, name, description, closed)
		 VALUES ($1, $2, $3, $4, 0)`,
		[tsId, id, tsName, tsDesc],
	);

	const createdTsRow = (
		await db.select<
			Array<
				Omit<Timesheet, "closed"> & {
					closed: number | boolean;
				}
			>
		>(
			`SELECT id, projectId, invoiceId, name, description, closed, createdAt, updatedAt FROM timesheets WHERE id = $1`,
			[tsId],
		)
	)[0];

	const createdTimesheet: Timesheet = {
		...createdTsRow,
		closed: !!createdTsRow.closed,
	};

	return { project: createdProject, timesheet: createdTimesheet };
};

export const deleteProject = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("projectId") || "");

	try {
		await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
	} catch (err) {
		console.error(err);
	}
};
