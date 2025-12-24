export type Nullable<T> = T | null | undefined;

export type Project = {
	id: number;
	name: string;
	active: boolean;
	customerId: Nullable<string>;
	rate: Nullable<number>;
	description: Nullable<string>;
	createdAt: number;
	updatedAt: number;
};

export type Timesheet = {
	id: number;
	projectId: number;
	invoiceId: Nullable<string>;
	name: string;
	description: Nullable<string>;
	closed: boolean;
	createdAt: number;
	updatedAt: number;
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
	id: number;
	timesheetId: number;
	date: number;
	minutes: number;
	description: string;
	amount: number;
	createdAt: number;
	updatedAt: number;
};

export type TimesheetDetails = Timesheet & {
	entries: TimesheetEntry[];
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type Transaction = {
	id: number;
	projectId: number;
	date: number;
	description: string;
	amount: number;
	filePath?: string;
	createdAt: number;
	updatedAt: number;
};

export type SubmitTransaction = Pick<
	Transaction,
	"projectId" | "date" | "description" | "amount" | "filePath"
>;