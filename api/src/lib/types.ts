export interface Env {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
	CF_ACCESS_BYPASS?: string;
	CF_ACCESS_DEV_EMAIL?: string;
	ENCRYPTION_KEY: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_ADDRESS?: string;
	APP_BASE_URL?: string;
}

type Nullable<T> = T | null | undefined;

export type Project = {
	id: string;
	userId: number;
	name: string;
	active: boolean | number;
	customerId: Nullable<string>;
	rate_in_cents: Nullable<number>;
	description: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type Timesheet = {
	id: string;
	userId: number;
	projectId: string;
	name: string;
	description: Nullable<string>;
	active: boolean | number;
	createdAt: string;
	updatedAt: string;
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

export type TimesheetWithProject = Timesheet & {
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

export type TimesheetDetails = Timesheet & {
	entries: TimesheetEntry[];
	customerId: Nullable<string>;
	projectRate: Nullable<number>;
};

type Transaction = {
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

export type UserProfile = {
	id: number;
	uuid: string;
	displayName: string;
	email: string;
	venmoHandle: Nullable<string>;
	paypalHandle: Nullable<string>;
	businessName: Nullable<string>;
	businessAddress: Nullable<string>;
	// The API key itself is never returned to clients; only a boolean
	// indicator. The from-address is returned in plaintext.
	hasResendApiKey: boolean;
	resendFromAddress: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

export type Customer = {
	id: string;
	userId: number;
	name: string;
	email: string;
	address: Nullable<string>;
	consentToEmailInvoices: boolean | number;
	consentedAt: Nullable<string>;
	consentRequestedAt: Nullable<string>;
	createdAt: string;
	updatedAt: string;
};

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

export type InvoiceEventType =
	| "created"
	| "sent"
	| "paid"
	| "voided"
	| "viewed";

export type InvoiceEvent = {
	id: string;
	invoiceId: string;
	userId: number;
	type: InvoiceEventType;
	payload: Nullable<string>;
	createdAt: string;
};

export type CustomerEventType =
	| "consent_requested"
	| "consent_granted"
	| "consent_declined"
	| "consent_revoked";

export type CustomerEvent = {
	id: string;
	customerId: string;
	userId: number;
	type: CustomerEventType;
	payload: Nullable<string>;
	createdAt: string;
};

/**
 * Snapshot of all invoice-relevant data, frozen at send time.
 * Stored encrypted on `invoices.snapshot` so later edits to projects/customers/users
 * never mutate a sent invoice. The hosted invoice page and the email body both
 * render from this snapshot.
 */
export type InvoiceSnapshot = {
	seller: {
		businessName: string;
		businessAddress: string;
		email: string;
		venmoHandle: Nullable<string>;
		paypalHandle: Nullable<string>;
	};
	buyer: {
		name: string;
		email: string;
		address: Nullable<string>;
	};
	invoice: {
		number: string;
		id: string;
		issuedAt: string;
		dueDate: string;
		description: Nullable<string>;
		amountCents: number;
	};
	lineItems: Array<{
		date: Nullable<string>;
		description: string;
		minutes: Nullable<number>;
		amountCents: number;
	}>;
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
