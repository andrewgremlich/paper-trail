import { create } from "zustand";
import { ProjectPageTab } from "./types";
import type { Project, Timesheet } from "./db";

type PaperTrailState = {
	projectModalActive: boolean;
	timesheetModalActive: boolean;
	settingsModalActive: boolean;
	activeProjectId: number | undefined;
	activeTimesheetId: number | undefined;
	projects: Project[];
	timesheets: Timesheet[];
	activeTab: ProjectPageTab;
	toggleProjectModal: (args?: { projectId?: number }) => void;
	toggleTimesheetModal: (args?: { timesheetId?: number }) => void;
	toggleSettingsModal: () => void;
	changeActiveTab: (tab: ProjectPageTab) => void;
	addProject: (project: Project) => void;
	addTimesheet: (timesheet: Timesheet) => void;
};

export const usePaperTrailStore = create<PaperTrailState>((set) => ({
	projectModalActive: false,
	timesheetModalActive: false,
	settingsModalActive: false,
	activeProjectId: undefined,
	activeTimesheetId: undefined,
	projects: [],
	timesheets: [],
	activeTab: ProjectPageTab.Transactions,
	toggleProjectModal: (args) =>
		set((state) => ({
			projectModalActive:
				args && "projectId" in args
					? !!args.projectId
					: !state.projectModalActive,
			activeProjectId: args?.projectId,
		})),
	toggleTimesheetModal: (args) =>
		set((state) => ({
			timesheetModalActive:
				args && "timesheetId" in args
					? !!args.timesheetId
					: !state.timesheetModalActive,
			activeTimesheetId: args?.timesheetId,
		})),
	toggleSettingsModal: () =>
		set((state) => ({ settingsModalActive: !state.settingsModalActive })),
	changeActiveTab: (tab) => set(() => ({ activeTab: tab })),
	addProject: (project) =>
		set((state) => ({ projects: [project, ...state.projects] })),
	addTimesheet: (timesheet) =>
		set((state) => ({ timesheets: [timesheet, ...state.timesheets] })),
}));
