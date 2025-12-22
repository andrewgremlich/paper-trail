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

export interface StripeInvoiceMinimal {
	id: string;
	status: string | null;
	pdf?: string | null;
	disabled?: boolean;
	[key: string]: unknown;
}

export interface StripeCustomerMinimal {
	id: string;
	name: string | null;
	email: string | null;
}
