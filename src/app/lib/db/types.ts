export type Nullable<T> = T | null | undefined;

export type Project = {
	id: string;
	userId: number;
	name: string;
	active: boolean;
	customerId: Nullable<string>;
	rate_in_cents: Nullable<number>;
	description: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type GenerateProject = Pick<
	Project,
	"name" | "customerId" | "rate_in_cents" | "description"
>;

export type Timesheet = {
	id: string;
	userId: number;
	projectId: string;
	name: string;
	description: Nullable<string>;
	closed: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CreateTimesheet = Pick<
	Timesheet,
	"name" | "projectId" | "description"
>;

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
	userId: number;
	timesheetId: string;
	date: string;
	minutes: number;
	description: string;
	amount: number;
	createdAt: string;
	updatedAt: string;
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
	id: string;
	userId: number;
	projectId: string;
	date: string;
	description: string;
	amount: number;
	filePath?: string;
	createdAt: string;
	updatedAt: string;
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
	// True if the user has stored a Resend API key. The key itself is never
	// returned by the API.
	hasResendApiKey: boolean;
	resendFromAddress: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type UpdateUserProfile = Pick<
	UserProfile,
	| "displayName"
	| "venmoHandle"
	| "paypalHandle"
	| "businessName"
	| "businessAddress"
> & {
	resendFromAddress?: Nullable<string>;
	// Three-state: undefined leaves the stored key alone, null/"" clears
	// it, a non-empty string replaces it.
	resendApiKey?: Nullable<string>;
};

export type Customer = {
	id: string;
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
	id: string;
	userId: number;
	customerId: string;
	timesheetId: Nullable<string>;
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
	customerId: string;
	timesheetId?: string;
	amountCents?: number;
	description?: string;
	issuedAt?: string;
	dueDate?: string;
};

export type InvoiceEvent = {
	id: string;
	invoiceId: string;
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
