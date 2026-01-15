import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { generateProject } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import type { Customer } from "@/lib/types";
import styles from "./styles.module.css";

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
			className={styles.form}
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
				containerClassName={styles.nameInput}
				className={styles.fullWidth}
			/>
			<Input
				type="number"
				name="rate"
				placeholder="dollars/hour"
				required
				label="Rate"
				containerClassName={styles.rateInput}
				className={styles.fullWidth}
			/>
			<Select
				name="customerId"
				label="Customer"
				containerClassName={styles.customerSelect}
				required
				options={[{ value: "", label: "Select a customer" }].concat(
					customers?.map((customer) => ({
						value: customer.id,
						label: `${customer.name} (${customer.email})`,
					})) ?? [],
				)}
			/>
			<Input
				name="description"
				placeholder="Awesome project description"
				required
				containerClassName={styles.descriptionInput}
				className={styles.fullWidth}
				label="Project Description"
			/>
			<Button type="submit" size="lg" variant="default">
				Generate Project
			</Button>
		</form>
	);
};
