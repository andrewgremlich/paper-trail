export type Nullable<T> = T | null | undefined;

export type Project = {
	id: number;
	userId: number;
	name: string;
	active: boolean;
	customerId: Nullable<string>;
	rate_in_cents: Nullable<number>;
	description: Nullable<string>;
	createdAt: number;
	updatedAt: number;
};

export type GenerateProject = Pick<
	Project,
	"name" | "customerId" | "rate_in_cents" | "description"
>;

export type Timesheet = {
	id: number;
	userId: number;
	projectId: number;
	invoiceId: Nullable<string>;
	name: string;
	description: Nullable<string>;
	active: boolean;
	createdAt: number;
	updatedAt: number;
};

export type CreateTimesheet = Pick<
	Timesheet,
	"name" | "projectId" | "description"
>;

export type MinimalTimesheet = Pick<
	Timesheet,
	"id" | "name" | "description" | "createdAt" | "updatedAt" | "active"
>;

export type TimesheetWithProject = Timesheet & {
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type TimesheetEntry = {
	id: number;
	userId: number;
	timesheetId: number;
	date: string;
	minutes: number;
	description: string;
	amount: number;
	createdAt: number;
	updatedAt: number;
};

export type CreateTimesheetEntry = Pick<
	TimesheetEntry,
	"timesheetId" | "date" | "minutes" | "amount" | "description"
>;

export type UpdateTimesheetEntry = Pick<
	TimesheetEntry,
	"id" | "date" | "minutes" | "description" | "amount"
>;

export type TimesheetDetails = Timesheet & {
	entries: TimesheetEntry[];
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type Transaction = {
	id: number;
	userId: number;
	projectId: number;
	date: string;
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

export type UpdateTransaction = Pick<
	Transaction,
	"id" | "projectId" | "date" | "description" | "amount" | "filePath"
>;

export type UserProfile = {
	id: number;
	uuid: string;
	displayName: string;
	email: string;
	createdAt: number;
	updatedAt: number;
};

export type UpdateUserProfile = Pick<UserProfile, "displayName" | "email">;

export type SyncCode = {
	uuid: string;
	syncUrl: string;
	authToken: string;
};

export type ExportData = {
	version: string;
	exportDate: string;
	projects: Project[];
	timesheets: Timesheet[];
	timesheetEntries: TimesheetEntry[];
	transactions: Transaction[];
	userProfile?: UserProfile;
};
