import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { H1, Main } from "./components/HtmlElements";
import { getAllProjects } from "./lib/db/projects";
import { Grid } from "./components/Grid";
import { Flex } from "./components/Flex";
import { getAllTransactions, upsertTransaction } from "./lib/db";
import { useEffect, useState, type FormEvent } from "react";
import { Edit } from "lucide-react";
import { openAttachment, saveAttachment } from "./lib/fileStorage";

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
	const { mutateAsync: submitTransaction } = useMutation({
		mutationFn: async (formData: FormData) => {
			const date = formData.get("date") as string;
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
				date: new Date(date).getTime(),
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
				as="form"
				className="pb-6"
				colsClass="grid-cols-5"
				onSubmit={async (evt: FormEvent<HTMLFormElement>) => {
					evt.preventDefault();
					await submitTransaction(new FormData(evt.currentTarget));
					evt.currentTarget.reset();
				}}
			>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Date</span>
					<input name="date" type="date" className="border rounded p-2" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Description</span>
					<input
						name="description"
						type="text"
						className="border rounded p-2"
					/>
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Account</span>
					<select
						name="projectId"
						className="p-2 border rounded"
						onChange={(e) => {
							const projectId = e.target.value
								? parseInt(e.target.value, 10)
								: null;
							setActiveProjectId(projectId);
						}}
						value={activeProjectId?.toString() ?? ""}
					>
						<option value="">Select Project</option>
						{projects?.map((project) => (
							<option key={project.id} value={project.id.toString()}>
								{project.name}
							</option>
						))}
					</select>
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Amount</span>
					<input name="amount" type="number" className="border rounded p-2" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">File</span>
					<input name="file" type="file" className="border rounded p-2" />
				</Flex>
				<input name="projectId" type="hidden" value={activeProjectId ?? ""} />
				<button type="submit" className="sr-only">
					Submit
				</button>
			</Grid>

			{transactions?.map((tx) => {
				const path = tx.filePath ?? "";
				return (
					<Grid
						key={tx.id}
						as="form"
						className="border-b-2 py-2"
						colsClass="grid-cols-6"
					>
						<Flex as="span" justify="center" items="center">
							{tx.date}
						</Flex>
						<Flex as="span" justify="center" items="center">
							{tx.description}
						</Flex>
						<Flex as="span" justify="center" items="center">
							{projects?.find((project) => project.id === tx.projectId)?.name}
						</Flex>
						<Flex as="span" justify="center" items="center">
							${tx.amount.toFixed(2)}
						</Flex>
						<Flex as="span" justify="center" items="center">
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
						</Flex>
						<Flex as="span" justify="center" items="center">
							<button
								type="button"
								className="cursor-pointer hover:bg-blue-500 p-2 rounded"
								onClick={() => {
									console.log("edit this transaction entry");
								}}
							>
								<Edit size={24} />
							</button>
						</Flex>
					</Grid>
				);
			})}
		</Main>
	);
};
