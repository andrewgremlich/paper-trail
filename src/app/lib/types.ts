// Shared app types based on usage across components

// Stripe customer subset used in forms and selectors
export type Customer = {
	id: string;
	name: string | null;
	email: string | null;
};

// App navigation tabs used by Nav and App switch
export enum ProjectPageTab {
	Timesheet = "Timesheet",
	FileStorage = "FileStorage",
	Accounting = "Accounting",
}

// Timesheet table row shape used by TimesheetTable
export type TimesheetRecord = {
	id: string;
	date: string; // ISO date string
	hours: number;
	description: string;
	rate: number; // $/hr
	amount: number; // computed: hours * rate
};
