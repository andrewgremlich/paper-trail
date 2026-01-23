import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TransactionForm } from "./components/features/transactions/TransactionForm";
import { TransactionList } from "./components/features/transactions/TransactionList";
import { H1, Main, P } from "./components/layout/HtmlElements";
import {
	deleteTransaction,
	getTransactionsByProject,
	updateTransaction,
	upsertTransaction,
} from "./lib/db";
import { getAllProjects } from "./lib/db/projects";
import { normalizeDateInput } from "./lib/db/utils";
import { saveAttachment } from "./lib/files/fileStorage";

export const Transactions = () => {
	const queryClient = useQueryClient();
	const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null);
	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: getAllProjects,
	});
	const {
		data: transactions,
		isLoading: isLoadingTransactions,
		error: transactionsError,
	} = useQuery({
		queryKey: ["transactions", activeProjectId],
		queryFn: () => getTransactionsByProject(activeProjectId as number),
		enabled: activeProjectId !== null,
	});
	const { mutate: submitTransaction } = useMutation({
		mutationFn: async (formData: FormData) => {
			const rawDate = formData.get("date") as string;
			const date = rawDate || new Date().toISOString().split("T")[0];
			const projectId = formData.get("projectId") as string;
			const description = formData.get("description") as string;
			const amount = formData.get("amount") as string;
			const file = formData.get("file") as File | null;
			const projectName =
				projects?.find((p) => p.id === Number(projectId))?.name || "default";

			let filePath = "";

			if (file && file.size > 0) {
				filePath = await saveAttachment(file, projectName);
			}

			await upsertTransaction({
				date,
				projectId: Number.parseInt(projectId, 10),
				description,
				amount: parseFloat(amount),
				filePath,
			});
		},
		onSuccess: async () => {
			if (activeProjectId != null) {
				await queryClient.invalidateQueries({
					queryKey: ["transactions", activeProjectId],
				});
			}
		},
		onError: (error) => {
			console.error("Failed to create transaction:", error);
		},
	});
	const { mutateAsync: saveEdit } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") || 0);
			const projectId = Number(formData.get("projectId") || 0);
			const rawDate = String(formData.get("date") || "");
			const date = normalizeDateInput(rawDate);
			const description = String(formData.get("description") || "").trim();
			const amountDollars = Number(formData.get("amount") || 0);

			await updateTransaction({
				id,
				projectId,
				date,
				description,
				amount: amountDollars,
			});
			await queryClient.invalidateQueries({
				queryKey: ["transactions", activeProjectId],
			});
		},
		onSuccess: async () => {
			setEditingId(null);
		},
		onError: (error) => {
			console.error("Failed to update transaction:", error);
		},
	});
	const { mutateAsync: removeTx } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") || 0);
			await deleteTransaction(id);
			await queryClient.invalidateQueries({
				queryKey: ["transactions", activeProjectId],
			});
		},
		onError: (error) => {
			console.error("Failed to delete transaction:", error);
		},
	});

	useEffect(() => {
		if (activeProjectId == null && projects?.length) {
			setActiveProjectId(projects[0].id);
		}
	}, [projects, activeProjectId]);

	if (isLoadingTransactions) {
		return (
			<Main>
				<H1>Transactions</H1>
				<P>Loading transactions...</P>
			</Main>
		);
	}

	if (transactionsError) {
		return (
			<Main>
				<H1>Transactions</H1>
				<P>Error loading transactions: {transactionsError.message}</P>
			</Main>
		);
	}

	return (
		<Main>
			<H1>Transactions</H1>

			<TransactionForm
				projects={projects}
				activeProjectId={activeProjectId}
				onProjectChange={setActiveProjectId}
				onSubmit={submitTransaction}
			/>

			<TransactionList
				transactions={transactions ?? []}
				projects={projects}
				editingId={editingId}
				onEdit={setEditingId}
				onCancelEdit={() => setEditingId(null)}
				onSave={saveEdit}
				onDelete={removeTx}
			/>
		</Main>
	);
};
