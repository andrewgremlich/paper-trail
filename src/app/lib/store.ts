import { create } from "zustand";

type PaperTrailState = {
	projectModalActive: boolean;
	timesheetModalActive: boolean;
	settingsModalActive: boolean;
	activeProjectId: string | undefined;
	activeTimesheetId: string | undefined;
	projects: unknown[];
	timesheets: unknown[];
	activeTab: unknown;
	toggleProjectModal: (args?: { projectId?: string }) => void;
	toggleTimesheetModal: (args?: { timesheetId?: string }) => void;
	toggleSettingsModal: () => void;
	changeActiveTab: (tab: unknown) => void;
	addProject: (project: unknown) => void;
	addTimesheet: (timesheet: unknown) => void;
};

export const usePaperTrailStore = create<PaperTrailState>((set) => ({
	projectModalActive: false,
	timesheetModalActive: false,
	settingsModalActive: false,
	activeProjectId: undefined,
	activeTimesheetId: undefined,
	projects: [],
	timesheets: [],
	activeTab: undefined,
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
