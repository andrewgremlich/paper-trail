import { getDb } from "./client";
import { generateTimesheet } from "./timesheets";
import type { MinimalTimesheet, Project, Timesheet } from "./types";

export const getAllProjects = async (): Promise<Project[]> => {
	const db = await getDb();
	const rows = await db.select<Project[]>(
		`SELECT id, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
		 FROM projects
		 ORDER BY createdAt DESC`,
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
		const projects = await db.select<Project[]>(
			`SELECT id, active, name, customerId, rate_in_cents, description, createdAt, updatedAt
			FROM projects WHERE id = $1`,
			[projectId],
		);
		const project = projects[0];
		if (!project) return null;

		const timesheets = await db.select<
			Array<MinimalTimesheet & { active: number | boolean }>
		>(
			`SELECT id, name, description, active, createdAt, updatedAt
		 FROM timesheets WHERE projectId = $1 ORDER BY createdAt DESC`,
			[projectId],
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

export const generateProject = async (
	incomingFormData: FormData,
): Promise<{ project: Project; timesheet: Timesheet } | undefined> => {
	try {
		const db = await getDb();
		const name = String(incomingFormData.get("name") || "").trim() as string;
		const rate = Number(incomingFormData.get("rate") || 0);
		const customerId = (incomingFormData.get("customerId") || "") as string;
		const description = (incomingFormData.get("description") || "") as string;

		const { lastInsertId: createdProjectId } = await db.execute(
			`INSERT INTO projects (name, customerId, rate_in_cents, description)
		 VALUES ($1, $2, $3, $4)`,
			[
				name,
				customerId,
				rate * 100, // store in integer cents to avoid floating point errors
				description,
			],
		);

		const createdProjectRow = (
			await db.select<Project[]>(
				`SELECT id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
				FROM projects WHERE id = $1`,
				[createdProjectId],
			)
		)[0];
		const createdProject: Project = {
			...createdProjectRow,
			active: !!createdProjectRow.active,
		};

		const tsName = `${new Date().toLocaleDateString()} Timesheet`;
		const tsDesc = "Initial timesheet";
		const formData = new FormData();
		formData.append("projectId", String(createdProject.id));
		formData.append("name", tsName);
		formData.append("description", tsDesc);
		const createdTimesheet = await generateTimesheet(formData);

		return { project: createdProject, timesheet: createdTimesheet };
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export const deleteProject = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = String(formData.get("id") || "");

	try {
		await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
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
				WHERE id = $6`,
				[name, customerId, rate * 100, description, active ? 1 : 0, id],
			);
			const updatedProject = (
				await db.select<Project[]>(
					`SELECT id, name, active, customerId, rate_in_cents, description, createdAt, updatedAt
					FROM projects WHERE id = $1`,
					[id],
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
