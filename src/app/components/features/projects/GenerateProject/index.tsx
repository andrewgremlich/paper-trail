import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { generateProject } from "@/lib/db";
import type { Customer } from "@/lib/db/types";
import { usePaperTrailStore } from "@/lib/store";
import styles from "./styles.module.css";

type Props = {
	customers?: Customer[];
	onSuccess?: () => void;
};

export const GenerateProject = ({ customers, onSuccess }: Props) => {
	const queryClient = useQueryClient();
	const { addProject, addTimesheet } = usePaperTrailStore();
	const { mutate: mutateProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			const name = String(formData.get("name") || "").trim();
			const rate = Number(formData.get("rate") || 0);
			const customerIdRaw = String(formData.get("customerId") || "");
			const customerId = customerIdRaw.length > 0 ? customerIdRaw : null;
			const description = String(formData.get("description") || "");

			return generateProject(
				{
					name,
					rate_in_cents: rate * 100,
					customerId,
					description,
				},
				{ createTimesheet: true },
			);
		},
		onSuccess: async (data) => {
			if (!data) return;
			const { project, timesheet } = data;

			addProject(project);
			if (timesheet) {
				addTimesheet(timesheet);
			}
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			onSuccess?.();
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
				options={[
					{ value: "", label: "Select a customer", disabled: true },
					...(customers?.map((customer) => ({
						value: customer.id,
						label: `${customer.name} (${customer.email})`,
					})) ?? []),
				]}
			/>
			<Input
				name="description"
				placeholder="Awesome project description"
				required
				containerClassName={styles.descriptionInput}
				className={styles.fullWidth}
				label="Project Description"
			/>
			<Button
				type="submit"
				size="lg"
				variant="default"
				leftIcon={<FolderPlus size={16} />}
			>
				Generate Project
			</Button>
		</form>
	);
};
