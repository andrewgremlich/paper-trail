// Transaction type used by Accounting table
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
