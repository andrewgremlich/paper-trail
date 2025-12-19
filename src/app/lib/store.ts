import { create } from "zustand";

type Id = string | undefined;

type PaperTrailState = {
	// Modal state
	projectModalActive: boolean;
	timesheetModalActive: boolean;
	settingsModalActive: boolean;

	// Currently selected entities
	activeProjectId: Id;
	activeTimesheetId: Id;

	// Optional client-side caches (used by UI helpers)
	projects: unknown[];
	timesheets: unknown[];

	// Navigation
	// Keep type flexible to avoid coupling to enum definition location
	activeTab: unknown;

	// Actions
	toggleProjectModal: (args?: { projectId?: string }) => void;
	toggleTimesheetModal: (args?: { timesheetId?: string }) => void;
	toggleSettingsModal: () => void;
	changeActiveTab: (tab: unknown) => void;
	addProject: (project: unknown) => void;
	addTimesheet: (timesheet: unknown) => void;
};

export const usePaperTrailStore = create<PaperTrailState>((set) => ({
	// Modal state
	projectModalActive: false,
	timesheetModalActive: false,
	settingsModalActive: false,

	// Selected entities
	activeProjectId: undefined,
	activeTimesheetId: undefined,

	// Client-side caches
	projects: [],
	timesheets: [],

	// Navigation (default to Timesheet-like tab; value is app-controlled)
	activeTab: undefined,

	// Actions
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
