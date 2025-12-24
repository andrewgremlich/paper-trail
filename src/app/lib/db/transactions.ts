import { getDb } from "./client";
import type { SubmitTransaction, Transaction } from "./types";

// Create or update a transaction by id
export const upsertTransaction = async (
	tx: SubmitTransaction,
): Promise<void> => {
	const db = await getDb();
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
		[tx.projectId, tx.date, tx.description, tx.amount, tx.filePath],
	);
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
	const db = await getDb();
	const rows = await db.select<Transaction[]>(
		`SELECT id, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions ORDER BY date ASC, createdAt ASC`,
	);
	return rows;
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
	return rows;
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
	return rows[0] ?? null;
};

// Delete: remove a transaction by id
export const deleteTransaction = async (id: string): Promise<void> => {
	const db = await getDb();
	await db.execute(`DELETE FROM transactions WHERE id = $1`, [id]);
};
