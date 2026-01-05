import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Edit, FolderOpen, Save, TrashIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "./components/Button";
import { Grid } from "./components/Grid";
import { H1, Main } from "./components/HtmlElements";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { Table, TBody, TD, TR } from "./components/Table";
import {
	deleteTransaction,
	getAllTransactions,
	updateTransaction,
	upsertTransaction,
} from "./lib/db";
import { getAllProjects } from "./lib/db/projects";
import { normalizeDateInput } from "./lib/db/utils";
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
			const id = Number(formData.get("id") || 0);
			const projectId = Number(formData.get("projectId") || 0);
			const rawDate = String(formData.get("date") || "");
			const date = normalizeDateInput(rawDate);
			const description = String(formData.get("description") || "").trim();
			const amountDollars = Number(formData.get("amount") || 0);
			const amountInCents = Math.round(amountDollars * 100);

			await updateTransaction({
				id,
				projectId,
				date,
				description,
				amount: amountInCents,
			});
			await queryClient.invalidateQueries({ queryKey: ["transactions"] });
		},
		onSuccess: async () => {
			setEditingId(null);
		},
	});
	const { mutateAsync: removeTx } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") || 0);
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
				/>
				<Input
					label="Description"
					name="description"
					type="text"
					className="border rounded p-2"
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
				<Table className="w-full">
					<TBody>
						{transactions?.map((tx) => {
							const path = tx.filePath ?? "";
							return (
								<TR key={tx.id}>
									{editingId === tx.id ? (
										<>
											<TD>
												<Input
													name="date"
													type="date"
													defaultValue={tx.date}
													form={`tx-edit-form-${tx.id}`}
													required
												/>
											</TD>
											<TD>
												<Input
													name="description"
													type="text"
													defaultValue={tx.description}
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
													form={`tx-edit-form-${tx.id}`}
												/>
											</TD>
											<TD>
												<Input
													name="amount"
													type="number"
													step="0.01"
													className="w-32"
													defaultValue={tx.amount}
													form={`tx-edit-form-${tx.id}`}
													required
												/>
											</TD>
											<TD>
												{path.length > 0 ? (
													<Button
														type="button"
														variant="ghost"
														className="text-blue-500 underline"
														onClick={async () => {
															await openAttachment(path);
														}}
													>
														View File
													</Button>
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
													<Button type="submit" size="sm" variant="ghost">
														<Save color="black" />
													</Button>
												</form>
											</TD>
											<TD>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() => setEditingId(null)}
												>
													<Ban color="black" />
												</Button>
											</TD>
										</>
									) : (
										<>
											<TD>
												<span>{formatDate(tx.date)}</span>
											</TD>
											<TD>
												<span>{tx.description}</span>
											</TD>
											<TD>
												<span>
													{
														projects?.find(
															(project) => project.id === tx.projectId,
														)?.name
													}
												</span>
											</TD>
											<TD>
												<span>${tx.amount.toFixed(2)}</span>
											</TD>
											<TD>
												{path.length > 0 ? (
													<Button
														type="button"
														size="sm"
														variant="ghost"
														onClick={async () => {
															await openAttachment(path);
														}}
													>
														<FolderOpen color="black" />
													</Button>
												) : (
													<span className="text-gray-500">No File</span>
												)}
											</TD>
											<TD>
												<Button
													variant="ghost"
													type="button"
													onClick={() => setEditingId(tx.id)}
												>
													<Edit color="black" />
												</Button>
											</TD>
											<TD>
												<form
													onSubmit={async (evt) => {
														evt.preventDefault();
														const fd = new FormData(evt.currentTarget);
														await removeTx(fd);
													}}
												>
													<input type="hidden" name="id" value={tx.id} />
													<Button
														variant="ghost"
														size="icon"
														type="submit"
														aria-label="Delete Transaction"
													>
														<TrashIcon color="black" />
													</Button>
												</form>
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
							<TD></TD>
						</TR>
					</TBody>
				</Table>
			}
		</Main>
	);
};
