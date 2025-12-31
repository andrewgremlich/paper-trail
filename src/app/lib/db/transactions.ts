import { getDb } from "./client";
import type { SubmitTransaction, Transaction } from "./types";
import { normalizeDateInput } from "./utils";

// Create or update a transaction by id
export const upsertTransaction = async (
	tx: SubmitTransaction,
): Promise<void> => {
	const db = await getDb();
	// Store amounts as integer cents to avoid floating point errors
	const amountInCents = Math.round(Math.max(0, tx.amount) * 100);
	await db.execute(
		`INSERT INTO transactions (projectId, date, description, amount, filePath)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT(id) DO UPDATE SET
			 projectId = excluded.projectId,
			 date = excluded.date,
			 description = excluded.description,
			 amount = excluded.amount,
			 filePath = excluded.filePath,
			 updatedAt = CAST(strftime('%s','now') AS INTEGER)`,
		[tx.projectId, tx.date, tx.description, amountInCents, tx.filePath],
	);
};

export const updateTransaction = async (formData: FormData): Promise<void> => {
	const db = await getDb();
	const id = Number(formData.get("id") || 0);
	const projectId = Number(formData.get("projectId") || 0);
	const rawDate = String(formData.get("date") || "");
	const date = normalizeDateInput(rawDate);
	const description = String(formData.get("description") || "").trim();
	const amountDollars = Number(formData.get("amount") || 0);
	const amountInCents = Math.round(Math.max(0, amountDollars) * 100);

	await db.execute(
		`UPDATE transactions
		 SET projectId = $2, date = $3, description = $4, amount = $5
		 WHERE id = $1`,
		[id, projectId, date, description, amountInCents],
	);
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
	const db = await getDb();
	const rows = await db.select<Transaction[]>(
		`SELECT id, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions ORDER BY date ASC, createdAt ASC`,
	);
	// Convert integer cents to dollars for UI consumption
	return rows.map((r) => ({ ...r, amount: r.amount / 100 }));
};

// Read: list all transactions for a project
export const getTransactionsByProject = async (
	projectId: number,
): Promise<Transaction[]> => {
	const db = await getDb();
	const rows = await db.select<Transaction[]>(
		`SELECT id, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions WHERE projectId = $1 ORDER BY date ASC, createdAt ASC`,
		[projectId],
	);
	return rows.map((r) => ({ ...r, amount: r.amount / 100 }));
};

// Read: get a single transaction by id
export const getTransactionById = async (
	id: number,
): Promise<Transaction | null> => {
	const db = await getDb();
	const rows = await db.select<Transaction[]>(
		`SELECT id, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions WHERE id = $1`,
		[id],
	);
	const row = rows[0] ?? null;
	return row ? { ...row, amount: row.amount / 100 } : null;
};

// Delete: remove a transaction by id
export const deleteTransaction = async (id: string): Promise<void> => {
	const db = await getDb();
	await db.execute(`DELETE FROM transactions WHERE id = $1`, [id]);
};
