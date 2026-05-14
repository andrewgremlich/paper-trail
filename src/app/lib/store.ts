import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Project, Timesheet } from "./db";
import { ProjectPageTab } from "./types";

export type Theme = "light" | "dark" | "system";

type ActiveModal =
	| { type: "project"; projectId: string }
	| { type: "timesheet"; timesheetId: string }
	| { type: "invoice"; invoiceId?: string }
	| null;

type PaperTrailState = {
	activeModal: ActiveModal;
	projects: Project[];
	timesheets: Timesheet[];
	activeTab: ProjectPageTab;
	theme: Theme;
	openModal: (modal: ActiveModal) => void;
	closeModal: () => void;
	changeActiveTab: (tab: ProjectPageTab) => void;
	addProject: (project: Project) => void;
	addTimesheet: (timesheet: Timesheet) => void;
	setTheme: (theme: Theme) => void;
};

export const usePaperTrailStore = create<PaperTrailState>()(
	persist(
		(set) => ({
			activeModal: null,
			projects: [],
			timesheets: [],
			activeTab: ProjectPageTab.Timesheets,
			theme: "system",
			openModal: (modal) => set(() => ({ activeModal: modal })),
			closeModal: () => set(() => ({ activeModal: null })),
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
			partialize: (state) => ({
				activeTab: state.activeTab,
				theme: state.theme,
			}),
		},
	),
);
