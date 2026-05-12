export type Nullable<T> = T | null | undefined;

export type Project = {
	id: number;
	userId: number;
	name: string;
	active: boolean;
	customerId: Nullable<number>;
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
	customerId: Nullable<number>;
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
	customerId: Nullable<number>;
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
	venmoHandle: Nullable<string>;
	paypalHandle: Nullable<string>;
	businessName: Nullable<string>;
	businessAddress: Nullable<string>;
	createdAt: number;
	updatedAt: number;
};

export type UpdateUserProfile = Pick<
	UserProfile,
	| "displayName"
	| "email"
	| "venmoHandle"
	| "paypalHandle"
	| "businessName"
	| "businessAddress"
>;

export type Customer = {
	id: number;
	userId: number;
	name: string;
	email: string;
	address: Nullable<string>;
	consentToEmailInvoices: boolean;
	consentedAt: Nullable<string>;
	consentRequestedAt: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type SubmitCustomer = Pick<Customer, "name" | "email" | "address">;

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type Invoice = {
	id: number;
	uuid: string;
	userId: number;
	customerId: number;
	timesheetId: Nullable<number>;
	number: string;
	status: InvoiceStatus;
	amount_cents: number;
	description: Nullable<string>;
	issuedAt: string;
	dueDate: string;
	sentAt: Nullable<string>;
	paidAt: Nullable<string>;
	voidedAt: Nullable<string>;
	archivedAt: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type CreateInvoice = {
	customerId: number;
	timesheetId?: number;
	amountCents?: number;
	description?: string;
	issuedAt?: string;
	dueDate?: string;
};

export type InvoiceEvent = {
	id: number;
	invoiceId: number;
	userId: number;
	type: "created" | "sent" | "paid" | "voided" | "viewed";
	payload: Nullable<string>;
	createdAt: string;
};

export type ExportData = {
	version: string;
	exportDate: string;
	encrypted?: boolean;
	projects: Project[];
	timesheets: Timesheet[];
	timesheetEntries: TimesheetEntry[];
	transactions: Transaction[];
	customers?: Customer[];
	invoices?: Invoice[];
	userProfile?: UserProfile;
};
