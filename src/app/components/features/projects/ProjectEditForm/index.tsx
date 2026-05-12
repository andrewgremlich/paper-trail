import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { type Project, updateProject } from "@/lib/db";
import { getCustomers } from "@/lib/db/customers";
import styles from "./styles.module.css";

type ProjectEditFormProps = {
	project: Project;
	onSaved?: () => void;
};

export const ProjectEditForm = ({ project, onSaved }: ProjectEditFormProps) => {
	const queryClient = useQueryClient();
	const { data: customers } = useQuery({
		queryKey: ["customers"],
		queryFn: getCustomers,
	});

	const updateProjectMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (!project?.id) return null;

			const customerIdRaw = String(formData.get("customerId") ?? "");
			const customerId = customerIdRaw.length > 0 ? customerIdRaw : null;

			const updatedProject: Project = {
				...project,
				name: String(formData.get("name") || ""),
				description: String(formData.get("description") || ""),
				// input is dollars/hour; backend stores integer cents
				rate_in_cents: Math.round(
					Number(formData.get("rate_in_cents") || 0) * 100,
				),
				customerId,
				active: true,
			};

			return await updateProject(updatedProject);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["project", project.id],
			});
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			onSaved?.();
		},
	});

	return (
		<Grid
			as="form"
			cols={2}
			alignItems="center"
			gap={6}
			onSubmit={async (evt: FormEvent<HTMLElement>) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget as HTMLFormElement);
				await updateProjectMutation.mutateAsync(formData);
			}}
		>
			<Input name="name" label="Name" defaultValue={project?.name || ""} />
			<Input
				name="description"
				label="Description"
				defaultValue={project?.description || ""}
			/>
			<Input
				name="rate_in_cents"
				label="Rate (USD/hr)"
				type="number"
				step="0.01"
				defaultValue={(project?.rate_in_cents ?? 0) / 100}
			/>
			<Select
				name="customerId"
				label="Customer"
				defaultValue={
					project.customerId != null ? String(project.customerId) : ""
				}
				options={[
					{ value: "", label: "— No customer —" },
					...(customers?.map((c) => ({
						value: String(c.id),
						label: `${c.name} (${c.email})`,
					})) ?? []),
				]}
			/>
			<Button type="submit" className={styles.saveButton} size="sm">
				Save Changes
			</Button>
		</Grid>
	);
};
