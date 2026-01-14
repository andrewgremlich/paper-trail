import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TR } from "@/components/ui/Table";
import { H1, Main } from "./components/HtmlElements";
import { TransactionEditRow } from "./components/TransactionEditRow";
import { TransactionViewRow } from "./components/TransactionViewRow";
import { Button } from "./components/ui/Button";
import { Grid } from "./components/ui/Grid";
import {
	deleteTransaction,
	getTransactionsByProject,
	updateTransaction,
	upsertTransaction,
} from "./lib/db";
import { getAllProjects } from "./lib/db/projects";
import { normalizeDateInput } from "./lib/db/utils";
import { saveAttachment } from "./lib/fileStorage";

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
			<Main className="max-w-5xl">
				<H1>Transactions</H1>
				<p>Loading transactions...</p>
			</Main>
		);
	}

	if (transactionsError) {
		return (
			<Main className="max-w-5xl">
				<H1>Transactions</H1>
				<p className="text-red-500">
					Error loading transactions: {transactionsError.message}
				</p>
			</Main>
		);
	}

	return (
		<Main className="max-w-5xl">
			<H1>Transactions</H1>

			<Grid
				cols={5}
				gap={12}
				as="form"
				className="pb-6"
				onSubmit={(evt: FormEvent<HTMLFormElement>) => {
					evt.preventDefault();
					submitTransaction(new FormData(evt.currentTarget));
					evt.currentTarget.reset();
				}}
			>
				<Input
					label="Date"
					name="date"
					type="date"
					className="border rounded p-2"
					defaultValue={new Date().toISOString().split("T")[0]}
					required
				/>
				<Input
					label="Description"
					name="description"
					type="text"
					className="border rounded p-2"
					required
				/>
				<Select
					label="Project"
					labelClassName="font-semibold"
					name="projectId"
					options={[
						{ value: "", label: "Select Project" },
						...(projects?.map((project) => ({
							value: project.id,
							label: project.name,
						})) ?? []),
					]}
					onChange={(e) => {
						const projectId = e.currentTarget.value
							? Number.parseInt(e.currentTarget.value, 10)
							: null;
						setActiveProjectId(projectId);
					}}
					value={activeProjectId?.toString() ?? ""}
					required
				/>
				<Input
					label="Amount"
					name="amount"
					step="0.01"
					type="number"
					className="border rounded p-2"
					required
				/>
				<Input
					label="File"
					name="file"
					type="file"
					className="border rounded p-2"
				/>
				<Button type="submit" variant="default" size="sm">
					Add Transaction
				</Button>
			</Grid>

			{!transactions || transactions.length === 0 ? (
				<p>No transactions found.</p>
			) : (
				<Table className="w-full">
					<TBody>
						{transactions.map((tx) => {
							const path = tx.filePath ?? "";
							return (
								<TR key={tx.id}>
									{editingId === tx.id ? (
										<TransactionEditRow
											tx={tx}
											projects={projects}
											path={path}
											onSave={saveEdit}
											onCancel={() => setEditingId(null)}
										/>
									) : (
										<TransactionViewRow
											tx={tx}
											projects={projects}
											path={path}
											onEdit={() => setEditingId(tx.id)}
											onDelete={removeTx}
										/>
									)}
								</TR>
							);
						})}

						<TR>
							<TD></TD>
							<TD></TD>
							<TD></TD>
							<TD>
								Total: $
								{transactions
									.reduce((acc, tx) => acc + tx.amount, 0)
									.toFixed(2)}
							</TD>
							<TD></TD>
							<TD></TD>
							<TD></TD>
						</TR>
					</TBody>
				</Table>
			)}
		</Main>
	);
};
