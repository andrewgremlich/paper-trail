import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Project, Timesheet } from "./db";
import { ProjectPageTab } from "./types";

export type Theme = "light" | "dark" | "system";

type PaperTrailState = {
	projectModalActive: boolean;
	timesheetModalActive: boolean;
	settingsModalActive: boolean;
	invoiceModalActive: boolean;
	activeProjectId: number | undefined;
	activeTimesheetId: number | undefined;
	activeInvoiceId: string | undefined;
	projects: Project[];
	timesheets: Timesheet[];
	activeTab: ProjectPageTab;
	theme: Theme;
	toggleProjectModal: (args?: { projectId?: number }) => void;
	toggleTimesheetModal: (args?: { timesheetId?: number }) => void;
	toggleSettingsModal: () => void;
	toggleInvoiceModal: (args?: { invoiceId?: string }) => void;
	changeActiveTab: (tab: ProjectPageTab) => void;
	addProject: (project: Project) => void;
	addTimesheet: (timesheet: Timesheet) => void;
	setTheme: (theme: Theme) => void;
};

export const usePaperTrailStore = create<PaperTrailState>()(
	persist(
		(set) => ({
			projectModalActive: false,
			timesheetModalActive: false,
			settingsModalActive: false,
			invoiceModalActive: false,
			activeProjectId: undefined,
			activeTimesheetId: undefined,
			activeInvoiceId: undefined,
			projects: [],
			timesheets: [],
			activeTab: ProjectPageTab.Timesheets,
			theme: "system",
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
			toggleInvoiceModal: (args) =>
				set((state) => ({
					invoiceModalActive:
						args && "invoiceId" in args
							? !!args.invoiceId
							: !state.invoiceModalActive,
					activeInvoiceId: args?.invoiceId,
				})),
			changeActiveTab: (tab) => set(() => ({ activeTab: tab })),
			addProject: (project) =>
				set((state) => ({ projects: [project, ...state.projects] })),
			addTimesheet: (timesheet) =>
				set((state) => ({ timesheets: [timesheet, ...state.timesheets] })),
			setTheme: (theme) => set(() => ({ theme })),
		}),
		{
			name: "paper-trail-storage",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
