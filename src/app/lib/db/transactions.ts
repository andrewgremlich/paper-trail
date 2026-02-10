import { getDb } from "./client";
import type {
	SubmitTransaction,
	Transaction,
	UpdateTransaction,
} from "./types";
import { getCurrentUserId } from "./userProfile";

// Create or update a transaction by id
export const upsertTransaction = async (
	tx: SubmitTransaction,
): Promise<void> => {
	try {
		const db = await getDb();
		const userId = await getCurrentUserId();
		const amountInCents = Math.round(tx.amount * 100);
		await db.execute(
			`INSERT INTO transactions (projectId, date, description, amount, filePath, userId)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT(id) DO UPDATE SET
			 projectId = excluded.projectId,
			 date = excluded.date,
			 description = excluded.description,
			 amount = excluded.amount,
			 filePath = excluded.filePath,
			 updatedAt = CAST(strftime('%s','now') AS INTEGER)`,
			[
				tx.projectId,
				tx.date,
				tx.description,
				amountInCents,
				tx.filePath,
				userId,
			],
		);
	} catch (err) {
		console.error(err);
		throw err;
	}
};

export const updateTransaction = async ({
	id,
	projectId,
	date,
	description,
	amount,
}: UpdateTransaction): Promise<void> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	const amountInCents = Math.round(amount * 100);

	await db.execute(
		`UPDATE transactions
		 SET projectId = $2, date = $3, description = $4, amount = $5
		 WHERE id = $1 AND userId = $6`,
		[id, projectId, date, description, amountInCents, userId],
	);
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	const rows = await db.select<Transaction[]>(
		`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions WHERE userId = $1 ORDER BY date ASC, createdAt ASC`,
		[userId],
	);
	// Convert integer cents to dollars for UI consumption
	return rows.map((r) => ({ ...r, amount: r.amount / 100 }));
};

// Read: list all transactions for a project
export const getTransactionsByProject = async (
	projectId: number,
): Promise<Transaction[]> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	const rows = await db.select<Transaction[]>(
		`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions WHERE projectId = $1 AND userId = $2 ORDER BY date ASC, createdAt ASC`,
		[projectId, userId],
	);
	return rows.map((r) => ({ ...r, amount: r.amount / 100 }));
};

// Read: get a single transaction by id
export const getTransactionById = async (
	id: number,
): Promise<Transaction | null> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	const rows = await db.select<Transaction[]>(
		`SELECT id, userId, projectId, date, description, amount, filePath, createdAt, updatedAt
		 FROM transactions WHERE id = $1 AND userId = $2`,
		[id, userId],
	);
	const row = rows[0] ?? null;
	return row ? { ...row, amount: row.amount / 100 } : null;
};

// Delete: remove a transaction by id
export const deleteTransaction = async (id: number): Promise<void> => {
	const db = await getDb();
	const userId = await getCurrentUserId();
	await db.execute(`DELETE FROM transactions WHERE id = $1 AND userId = $2`, [
		id,
		userId,
	]);
};
