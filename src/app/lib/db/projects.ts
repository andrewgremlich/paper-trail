import { getDb } from "./client";
import { generateTimesheet } from "./timesheets";
import type {
	GenerateProject,
	MinimalTimesheet,
	Project,
	Timesheet,
} from "./types";
import { getCurrentUserId } from "./userProfile";

export const getAllProjects = async (): Promise<Project[]> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	const rows = await db.select<Project[]>(
		`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
		 FROM projects
		 WHERE userId = $1
		 ORDER BY createdAt DESC`,
		[userId],
	);
	return rows.map((r: Project) => ({ ...r, active: !!r.active }));
};

export type ProjectWithTimesheets = Project & {
	timesheets: MinimalTimesheet[];
};

export const getProjectById = async (
	projectId: number,
): Promise<ProjectWithTimesheets | null> => {
	try {
		const db = await getDb();
		const userId = await getCurrentUserId();
		const projects = await db.select<Project[]>(
			`SELECT id, userId, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = $1 AND userId = $2`,
			[projectId, userId],
		);
		const project = projects[0];
		if (!project) return null;

		const timesheets = await db.select<
			Array<MinimalTimesheet & { active: number | boolean }>
		>(
			`SELECT id, name, description, active, createdAt, updatedAt
		 FROM timesheets WHERE projectId = $1 AND userId = $2 ORDER BY createdAt DESC`,
			[projectId, userId],
		);

		const normalized: MinimalTimesheet[] = timesheets.map((t) => ({
			...t,
			active: !!t.active,
		}));

		return { ...project, timesheets: normalized };
	} catch (err) {
		console.error(err);
		return null;
	}
};

export const generateProject = async ({
	name,
	customerId,
	rate_in_cents,
	description,
}: GenerateProject): Promise<
	{ project: Project; timesheet: Timesheet } | undefined
> => {
	try {
		const db = await getDb();
		const userId = await getCurrentUserId();

		const { lastInsertId: createdProjectId } = await db.execute(
			`INSERT INTO projects (name, customerId, rate_in_cents, description, userId)
		 VALUES ($1, $2, $3, $4, $5)`,
			[name, customerId, rate_in_cents, description, userId],
		);

		const createdProjectRow = (
			await db.select<Project[]>(
				`SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
				FROM projects WHERE id = $1 AND userId = $2`,
				[createdProjectId, userId],
			)
		)[0];
		const createdProject: Project = {
			...createdProjectRow,
			active: !!createdProjectRow.active,
		};

		const createdTimesheet = await generateTimesheet({
			projectId: createdProject.id,
			name: `${new Date().toLocaleDateString()} Timesheet`,
			description: "Initial timesheet",
		});

		return { project: createdProject, timesheet: createdTimesheet };
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export const deleteProject = async (id: number): Promise<void> => {
	const db = await getDb();
	const userId = await getCurrentUserId();

	try {
		await db.execute(`DELETE FROM projects WHERE id = $1 AND userId = $2`, [
			id,
			userId,
		]);
	} catch (err) {
		console.error(err);
	}
};

export const updateProject = async ({
	id,
	name,
	customerId,
	rate_in_cents,
	description,
	active,
}: Project): Promise<Project | null> => {
	const db = await getDb();
	const userId = await getCurrentUserId();

	let rate = rate_in_cents;

	if (!rate) {
		rate = 0;
	}

	try {
		if (id) {
			// Update existing project
			await db.execute(
				`UPDATE projects
				SET name = $1, customerId = $2, rate_in_cents = $3, description = $4, active = $5, updatedAt = CURRENT_TIMESTAMP
				WHERE id = $6 AND userId = $7`,
				[name, customerId, rate * 100, description, active ? 1 : 0, id, userId],
			);
			const updatedProject = (
				await db.select<Project[]>(
					`SELECT id, userId, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
					FROM projects WHERE id = $1 AND userId = $2`,
					[id, userId],
				)
			)[0];
			return { ...updatedProject, active: !!updatedProject.active };
		} else {
			throw new Error("Project ID is required for update");
		}
	} catch (err) {
		console.error(err);
		return null;
	}
};
