import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generateProject } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import type { Customer } from "../lib/types";
import { Button } from "./Button";
import { Label } from "./HtmlElements";
import { Input } from "./Input";

export const GenerateProject = ({ customers }: { customers?: Customer[] }) => {
	const queryClient = useQueryClient();
	const { addProject, addTimesheet } = usePaperTrailStore();
	const { mutate: mutateProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			const name = String(formData.get("name") || "").trim() as string;
			const rate = Number(formData.get("rate") || 0);
			const customerId = (formData.get("customerId") || "") as string;
			const description = (formData.get("description") || "") as string;

			return generateProject({
				name,
				rate_in_cents: rate * 100,
				customerId,
				description,
			});
		},
		onSuccess: async (data) => {
			if (!data) return;
			const { project, timesheet } = data;

			addProject(project);
			addTimesheet(timesheet);
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
		},
	});

	return (
		<form
			className="grid grid-cols-3 gap-6"
			onSubmit={(e) => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				mutateProject(formData);
				e.currentTarget.reset();
			}}
		>
			<Input
				name="name"
				placeholder="Awesome Project"
				required
				label="Project Name"
				containerClassName="col-span-3"
				className="w-full"
			/>
			<Input
				type="number"
				name="rate"
				placeholder="dollars/hour"
				required
				label="Rate"
				containerClassName="col-span-1"
				className="w-full"
			/>
			<div className="col-span-2">
				<Label htmlFor="customerId">Customer</Label>
				<select
					name="customerId"
					required
					className="h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-slate-500 text-slate-900"
				>
					<option value="">Select a customer</option>
					{customers &&
						customers.length > 0 &&
						customers.map((customer) => (
							<option key={customer.id} value={customer.id}>
								{customer.name} ({customer.email})
							</option>
						))}
				</select>
			</div>
			<Input
				name="description"
				placeholder="Awesome project description"
				required
				containerClassName="col-span-3"
				className="w-full"
				label="Project Description"
			/>
			<Button type="submit" size="lg" variant="default">
				Generate Project
			</Button>
		</form>
	);
};
