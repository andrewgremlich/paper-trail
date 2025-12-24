import { useMutation, useQueryClient } from "@tanstack/react-query";

import { generateProject } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import type { Customer } from "../lib/types";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";

export const GenerateProject = ({ customers }: { customers?: Customer[] }) => {
	const queryClient = useQueryClient();
	const { addProject, addTimesheet } = usePaperTrailStore();
	const { mutate: mutateProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			return generateProject(formData);
		},
		onSuccess: async ({ project, timesheet }) => {
			addProject(project);
			addTimesheet(timesheet);

			await queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
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
			<div className="col-span-3">
				<Label htmlFor="name">Project Name</Label>
				<Input
					name="name"
					placeholder="Awesome Project"
					required
					className="w-full"
				/>
			</div>
			<div className="col-span-1">
				<Label htmlFor="rate">Rate</Label>
				<Input
					type="number"
					name="rate"
					placeholder="dollars/hour"
					required
					className="w-full"
				/>
			</div>
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
			<div className="col-span-3">
				<Label htmlFor="description">Project Description</Label>
				<textarea
					name="description"
					placeholder="Awesome project description"
					className="h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-slate-500 text-slate-900"
				/>
			</div>
			<Button type="submit" size="lg" variant="default">
				Generate Project
			</Button>
		</form>
	);
};
