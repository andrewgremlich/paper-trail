export type Nullable<T> = T | null | undefined;

export type Project = {
	id: string;
	name: string;
	status: string;
	customerId: Nullable<string>;
	rate: Nullable<number>;
	description: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type Timesheet = {
	id: string;
	projectId: string;
	invoiceId: Nullable<string>;
	name: string;
	description: Nullable<string>;
	closed: boolean;
	createdAt: string;
	updatedAt: string;
};

export type MinimalTimesheet = Pick<
	Timesheet,
	"id" | "name" | "description" | "createdAt" | "updatedAt" | "closed"
>;

export type TimesheetWithProject = Timesheet & {
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type TimesheetEntry = {
	id: string;
	timesheetId: string;
	date: string;
	hours: number;
	description: string;
	amount: number;
	createdAt: string;
	updatedAt: string;
};

export type TimesheetDetails = Timesheet & {
	entries: TimesheetEntry[];
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type AccountingTx = {
	id: string;
	date: string;
	description: string;
	account: number;
	category: string;
	amount: number;
	filePath: string | null;
};
