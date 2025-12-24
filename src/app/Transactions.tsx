import { useMutation, useQuery } from "@tanstack/react-query";

import { H1, Main } from "./components/HtmlElements";
import { getAllProjects } from "./lib/db/projects";
import { Grid, GridHeader, GridRow } from "./components/Grid";
import { Flex } from "./components/Flex";
import { upsertTransaction } from "./lib/db";
import { useEffect, useState, type FormEvent } from "react";

const exampleData = [
	{
		id: 1,
		date: "2024-01-15",
		description: "Office Supplies",
		account: "Expenses",
		category: "Office",
		amount: 150.0,
		filePath: "/files/receipt1.pdf",
	},
	{
		id: 2,
		date: "2024-01-20",
		description: "Client Lunch",
		account: "Meals",
		category: "Entertainment",
		amount: 85.5,
		filePath: "/files/receipt2.pdf",
	},
	{
		id: 3,
		date: "2024-01-25",
		description: "Software Subscription",
		account: "Software",
		category: "Subscriptions",
		amount: 299.99,
		filePath: "/files/receipt3.pdf",
	},
];

export const Transactions = () => {
	const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: getAllProjects,
	});

	useEffect(() => {
		if (activeProjectId == null && projects?.length) {
			setActiveProjectId(projects[0].id);
		}
	}, [projects, activeProjectId]);
	const { mutateAsync: submitTransaction } = useMutation({
		mutationFn: async (formData: FormData) => {
			const date = formData.get("date") as string;
			const projectId = parseInt(formData.get("projectId") as string, 10);
			const description = formData.get("description") as string;
			const account = formData.get("account") as string;
			const category = formData.get("category") as string;
			const amount = formData.get("amount");
			const file = formData.get("file") as File | null;

			// Here you would typically handle file upload and get a file path
			const filePath = file ? `/files/${file.name}` : "";

			// For demonstration, we just log the transaction data
			const transaction = {
				date,
				projectId,
				description,
				account,
				category,
				amount,
				filePath,
			};
			console.log("Submitting transaction:", transaction);

			// await upsertTransaction(transaction);
		},
	});

	return (
		<Main className="max-w-5xl">
			<H1>Transactions</H1>

			<select
				className="mb-4 p-2 border border-gray-300 rounded"
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

			<GridHeader
				headers={[
					"Date",
					"Description",
					"Account",
					"Category",
					"Amount",
					"File",
				]}
				// colsClass="grid-cols-6" // optional override
				// gapClass="gap-4"       // optional override
			/>

			{exampleData.map((tx) => (
				<GridRow key={tx.id}>
					<div>{tx.date}</div>
					<div>{tx.description}</div>
					<div>{tx.account}</div>
					<div>{tx.category}</div>
					<div>${tx.amount.toFixed(2)}</div>
					<div>
						<a href={tx.filePath} className="text-blue-500 underline">
							View File
						</a>
					</div>
				</GridRow>
			))}

			<Grid
				as="form"
				onSubmit={async (evt: FormEvent<HTMLFormElement>) => {
					evt.preventDefault();
					submitTransaction(new FormData(evt.currentTarget));
				}}
			>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Date</span>
					<input name="date" type="date" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Description</span>
					<input name="description" type="text" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Account</span>
					<input name="account" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Category</span>
					<input name="category" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">Amount</span>
					<input name="amount" type="number" />
				</Flex>
				<Flex as="label" direction="col">
					<span className="font-semibold mb-1">File</span>
					<input name="file" type="file" />
				</Flex>
				<input name="projectId" type="hidden" value={activeProjectId ?? ""} />
				<button type="submit" className="sr-only">
					Submit
				</button>
			</Grid>
		</Main>
	);
};
