export type Customer = {
	id: string;
	name: string | null;
	email: string | null;
};

export enum ProjectPageTab {
	Timesheet = "Timesheet",
	FileStorage = "FileStorage",
	Accounting = "Accounting",
}
