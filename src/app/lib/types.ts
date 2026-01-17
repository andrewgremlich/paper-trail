export type Customer = {
	id: string;
	name: string | null;
	email: string | null;
};

export enum ProjectPageTab {
	Timesheets = "Timesheets",
	Transactions = "Transactions",
	Invoices = "Invoices",
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

export type Transaction = {
	id: string;
	date: string; // ISO date string
	description: string;
	account: number; // account id or number
	category: string;
	amount: number; // positive for income, negative for expense
	file: File | null; // in-memory selection (not persisted)
	filePath?: string | null; // persisted relative path under AppData
};
