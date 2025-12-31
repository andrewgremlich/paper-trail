import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Grid } from "./components/Grid";
import { H1, Main } from "./components/HtmlElements";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { Table, TBody, TD, TR } from "./components/Table";
import { getAllTransactions, upsertTransaction, updateTransaction, deleteTransaction } from "./lib/db";
import { getAllProjects } from "./lib/db/projects";
import { openAttachment, saveAttachment } from "./lib/fileStorage";
import { formatDate } from "./lib/utils";

export const Transactions = () => {
	const queryClient = useQueryClient();
	const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null);
	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: getAllProjects,
	});
	const { data: transactions } = useQuery({
		queryKey: ["transactions"],
		queryFn: getAllTransactions,
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
				projectId: parseInt(projectId as unknown as string, 10),
				description,
				amount: parseFloat(amount as string),
				filePath,
			});
		},
		onSuccess: async () => {
			if (activeProjectId != null) {
				await queryClient.invalidateQueries({
					queryKey: ["transactions"],
				});
			}
		},
	});

	const { mutateAsync: saveEdit } = useMutation({
		mutationFn: async (formData: FormData) => {
			await updateTransaction(formData);
			await queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
		onSuccess: async () => {
			setEditingId(null);
		},
	});

	const { mutateAsync: removeTx } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = String(formData.get("id") || "");
			await deleteTransaction(id);
			await queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
	});

	useEffect(() => {
		if (activeProjectId == null && projects?.length) {
			setActiveProjectId(projects[0].id);
		}
	}, [projects, activeProjectId]);

	return (
		<Main className="max-w-5xl">
			<H1>Transactions</H1>

			<Grid
				cols={5}
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
				/>
				<Input
					label="Description"
					name="description"
					type="text"
					className="border rounded p-2"
				/>
				<Select
					label="Project"
					labelClassName="font-semibold mb-1"
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
							? parseInt(e.currentTarget.value, 10)
							: null;
						setActiveProjectId(projectId);
					}}
					value={activeProjectId?.toString() ?? ""}
				/>
				<Input
					label="Amount"
					name="amount"
					step="0.01"
					type="number"
					className="border rounded p-2"
				/>
				<Input
					label="File"
					name="file"
					type="file"
					className="border rounded p-2"
				/>
				<button type="submit" className="sr-only">
					Submit
				</button>
			</Grid>

			{!transactions || transactions.length === 0 ? (
				<p>No transactions found.</p>
			) : null}

			{
				<Table>
					<TBody>
						{transactions?.map((tx) => {
							const path = tx.filePath ?? "";
							return (
								<TR key={tx.id}>
									{editingId === tx.id ? (
										<>
											<TD>
												<input
													name="date"
													type="date"
													defaultValue={tx.date}
													className="border px-2 py-1 rounded-md"
													form={`tx-edit-form-${tx.id}`}
													required
												/>
											</TD>
											<TD>
												<input
													name="description"
													type="text"
													defaultValue={tx.description}
													className="border px-2 py-1 rounded-md w-full"
													form={`tx-edit-form-${tx.id}`}
													required
												/>
											</TD>
											<TD>
												<Select
													name="projectId"
													value={tx.projectId}
													options={
														projects?.map((project) => ({
															value: project.id,
															label: project.name,
														})) ?? []
													}
													containerClassName=""
													className="border rounded p-2"
													form={`tx-edit-form-${tx.id}`}
												/>
											</TD>
											<TD>
												<input
													name="amount"
													type="number"
													step="0.01"
													defaultValue={tx.amount}
													className="border px-2 py-1 rounded-md w-28"
													form={`tx-edit-form-${tx.id}`}
													required
												/>
											</TD>
											<TD>
												{path.length > 0 ? (
													<button
														type="button"
														className="text-blue-500 underline"
														onClick={async () => {
															await openAttachment(path);
														}}
													>
														View File
													</button>
												) : (
													<span className="text-gray-500">No File</span>
												)}
											</TD>
											<TD>
												<form
													id={`tx-edit-form-${tx.id}`}
													onSubmit={async (evt) => {
														evt.preventDefault();
														const fd = new FormData(evt.currentTarget);
														fd.set("id", String(tx.id));
														try {
															await saveEdit(fd);
														} catch (e) {
															console.error(e);
														}
													}}
												>
													<button
														type="submit"
														className="cursor-pointer bg-blue-500 text-white px-3 py-2 rounded"
													>
														Save
													</button>
													<button
														type="button"
														className="cursor-pointer ml-2 px-3 py-2 rounded border"
														onClick={() => setEditingId(null)}
													>
														Cancel
													</button>
												</form>
											</TD>
										</>
									) : (
										<>
											<TD>{formatDate(tx.date)}</TD>
											<TD>{tx.description}</TD>
											<TD>
												{
													projects?.find((project) => project.id === tx.projectId)
														?.name
												}
											</TD>
											<TD>${tx.amount.toFixed(2)}</TD>
											<TD>
												{path.length > 0 ? (
													<button
														type="button"
														className="text-blue-500 underline"
														onClick={async () => {
															await openAttachment(path);
														}}
													>
														View File
													</button>
												) : (
													<span className="text-gray-500">No File</span>
												)}
											</TD>
											<TD>
												<form
													onSubmit={async (evt) => {
														evt.preventDefault();
														const fd = new FormData(evt.currentTarget);
														try {
															await removeTx(fd);
														} catch (e) {
															console.error(e);
														}
													}}
												>
													<input type="hidden" name="id" value={tx.id} />
													<button
														type="submit"
														className="cursor-pointer hover:bg-red-500 text-red-600 hover:text-white p-2 rounded border border-red-400"
													>
														Delete
													</button>
												</form>
												<button
													type="button"
													className="cursor-pointer hover:bg-blue-500 p-2 rounded ml-2"
													onClick={() => setEditingId(tx.id)}
												>
													<Edit size={24} />
												</button>
											</TD>
										</>
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
									?.reduce((acc, tx) => acc + tx.amount, 0)
									.toFixed(2)}
							</TD>
							<TD></TD>
							<TD></TD>
						</TR>
					</TBody>
				</Table>
			}
		</Main>
	);
};
