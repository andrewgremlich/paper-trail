import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { type Project, updateProject } from "../lib/db";
import { Button } from "./Button";
import { Grid } from "./Grid";
import { Input } from "./Input";

type ProjectEditFormProps = {
	project: Project;
	onSaved?: () => void;
};

export const ProjectEditForm = ({ project, onSaved }: ProjectEditFormProps) => {
	const queryClient = useQueryClient();

	const updateProjectMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (!project || !project.id) return null;

			const updatedProject: Project = {
				...project,
				name: String(formData.get("name") || ""),
				description: String(formData.get("description") || ""),
				// keep existing semantics: value interpreted as provided number
				rate_in_cents: Number(formData.get("rate_in_cents") || 0),
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
			gap={6}
			onSubmit={async (evt: FormEvent<HTMLFormElement>) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget);
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
				defaultValue={(project?.rate_in_cents ?? 0) / 100}
			/>
			<Button type="submit" className="mt-4">
				Save Changes
			</Button>
		</Grid>
	);
};
