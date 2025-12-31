import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Grid } from "./components/Grid";
import { H1, Main } from "./components/HtmlElements";
import { Input } from "./components/Input";
import { Select } from "./components/Select";
import { Table, TBody, TD, TR } from "./components/Table";
import { getAllTransactions, upsertTransaction } from "./lib/db";
import { getAllProjects } from "./lib/db/projects";
import { openAttachment, saveAttachment } from "./lib/fileStorage";
import { formatDate } from "./lib/utils";

export const Transactions = () => {
	const queryClient = useQueryClient();
	const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
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
										<button
											type="button"
											className="cursor-pointer hover:bg-blue-500 p-2 rounded"
											onClick={() => {
												console.log("edit this transaction entry");
											}}
										>
											<Edit size={24} />
										</button>
									</TD>
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
