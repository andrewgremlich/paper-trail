import { api } from "./client";
import type {
	GenerateProject,
	MinimalTimesheet,
	Project,
	Timesheet,
} from "./types";

export type ProjectWithTimesheets = Project & {
	timesheets: MinimalTimesheet[];
};

export const getAllProjects = async (): Promise<Project[]> => {
	return api.get<Project[]>("/projects");
};

export const getProjectById = async (
	projectId: number,
): Promise<ProjectWithTimesheets | null> => {
	try {
		return await api.get<ProjectWithTimesheets>(`/projects/${projectId}`);
	} catch {
		return null;
	}
};

export const generateProject = async (
	{ name, customerId, rate_in_cents, description }: GenerateProject,
	{ createTimesheet = false }: { createTimesheet?: boolean } = {},
): Promise<{ project: Project; timesheet: Timesheet | null } | undefined> => {
	try {
		const query = createTimesheet ? "?createTimesheet=true" : "";
		return await api.post<{ project: Project; timesheet: Timesheet | null }>(
			`/projects${query}`,
			{ name, customerId, rate_in_cents, description },
		);
	} catch (err) {
		console.error(err);
		return undefined;
	}
};

export const deleteProject = async (id: number): Promise<void> => {
	try {
		await api.delete(`/projects/${id}`);
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
	try {
		return await api.put<Project>(`/projects/${id}`, {
			name,
			customerId,
			rate_in_cents,
			description,
			active,
		});
	} catch (err) {
		console.error(err);
		return null;
	}
};
