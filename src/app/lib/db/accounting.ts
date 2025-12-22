import { getDb } from "./client";
import type { AccountingTx } from "./types";

const ensureAccountingTable = async (): Promise<void> => {
	const db = await getDb();
	await db.execute(
		`CREATE TABLE IF NOT EXISTS accounting_transactions (
			id TEXT PRIMARY KEY,
			date TEXT NOT NULL,
			description TEXT NOT NULL,
			account INTEGER NOT NULL,
			category TEXT NOT NULL,
			amount REAL NOT NULL,
			filePath TEXT,
			createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
	);
};

export const upsertAccountingTransaction = async (
	tx: AccountingTx,
): Promise<void> => {
	await ensureAccountingTable();
	const db = await getDb();
	await db.execute(
		`INSERT INTO accounting_transactions (id, date, description, account, category, amount, filePath, createdAt, updatedAt)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT(id) DO UPDATE SET
			 date = excluded.date,
			 description = excluded.description,
			 account = excluded.account,
			 category = excluded.category,
			 amount = excluded.amount,
			 filePath = excluded.filePath,
			 updatedAt = CURRENT_TIMESTAMP`,
		[
			tx.id,
			tx.date,
			tx.description,
			tx.account,
			tx.category,
			tx.amount,
			tx.filePath,
		],
	);
};
