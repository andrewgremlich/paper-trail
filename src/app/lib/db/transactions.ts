import { api } from "./client";
import type {
	SubmitTransaction,
	Transaction,
	UpdateTransaction,
} from "./types";

export const upsertTransaction = async (
	tx: SubmitTransaction,
): Promise<void> => {
	await api.post("/transactions", {
		projectId: tx.projectId,
		date: tx.date,
		description: tx.description,
		amount: tx.amount,
		filePath: tx.filePath,
	});
};

export const updateTransaction = async ({
	id,
	projectId,
	date,
	description,
	amount,
	filePath,
}: UpdateTransaction): Promise<void> => {
	await api.put(`/transactions/${id}`, {
		projectId,
		date,
		description,
		amount,
		filePath,
	});
};

export const getAllTransactions = async (): Promise<Transaction[]> => {
	return api.get<Transaction[]>("/transactions");
};

export const getTransactionsByProject = async (
	projectId: number,
): Promise<Transaction[]> => {
	return api.get<Transaction[]>(`/transactions?projectId=${projectId}`);
};

export const getTransactionById = async (
	id: number,
): Promise<Transaction | null> => {
	try {
		return await api.get<Transaction>(`/transactions/${id}`);
	} catch {
		return null;
	}
};

export const deleteTransaction = async (id: number): Promise<void> => {
	await api.delete(`/transactions/${id}`);
};
