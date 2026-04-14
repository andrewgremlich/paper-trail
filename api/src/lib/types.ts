export interface Env {
	DB: D1Database;
	FILES_BUCKET: R2Bucket;
	CF_ACCESS_BYPASS?: string;
	CF_ACCESS_DEV_EMAIL?: string;
	ENCRYPTION_KEY: string;
	STRIPE_CLIENT_ID: string;
	STRIPE_CLIENT_SECRET: string;
	STRIPE_CONNECT_REDIRECT_URI: string;
}

export type Nullable<T> = T | null | undefined;

export type StripeConnection = {
	id: number;
	userId: number;
	accessToken: string;
	refreshToken: string | null;
	stripeUserId: string;
	stripePublishableKey: string | null;
	scope: string | null;
	connectedAt: string;
	createdAt: string;
	updatedAt: string;
};

export type Project = {
	id: number;
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
	id: number;
	userId: number;
	projectId: number;
	invoiceId: Nullable<string>;
	name: string;
	description: Nullable<string>;
	active: boolean | number;
	createdAt: string;
	updatedAt: string;
};

export type TimesheetEntry = {
	id: number;
	userId: number;
	timesheetId: number;
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

export type Transaction = {
	id: number;
	userId: number;
	projectId: number;
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
	createdAt: string;
	updatedAt: string;
};

export type ExportData = {
	version: string;
	exportDate: string;
	encrypted?: boolean;
	projects: Project[];
	timesheets: Timesheet[];
	timesheetEntries: TimesheetEntry[];
	transactions: Transaction[];
	userProfile?: UserProfile;
};
