import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
	deleteProject,
	getProjectById,
	type Project,
	updateProject,
} from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { Button } from "./Button";
import { CardPreview } from "./CardPreview";
import { DeleteItem } from "./DeleteItem";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { GenerateTimesheet } from "./GenerateTimesheet";
import { Grid } from "./Grid";
import { H2, P } from "./HtmlElements";
import { Input } from "./Input";

export const ProjectModal = () => {
	const [isEditing, setIsEditing] = useState(false);
	const queryClient = useQueryClient();
	const {
		projectModalActive,
		toggleProjectModal,
		toggleTimesheetModal,
		activeProjectId,
	} = usePaperTrailStore();
	const { data: project } = useQuery({
		queryKey: ["project", activeProjectId],
		queryFn: () => {
			if (activeProjectId) {
				return getProjectById(activeProjectId);
			}
			return null;
		},
		enabled: !!activeProjectId,
	});
	const updateProjectMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (!project || !project.id) return null;

			const updatedProject: Project = {
				...project,
				name: String(formData.get("name") || ""),
				description: String(formData.get("description") || ""),
				rate_in_cents: Number(formData.get("rate_in_cents") || 0),
				active: true,
			};

			return await updateProject(updatedProject);
		},
		onSuccess: async () => {
			// Invalidate and refetch
			await queryClient.invalidateQueries({
				queryKey: ["project", activeProjectId],
			});
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
		},
	});

	return (
		<Dialog
			className="px-10 py-8"
			variant="liquidGlass"
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
		>
			<Flex className="w-full" justify="between" items="start">
				<H2>{project?.name}</H2>
				<Flex gap={2} items="center">
					{project?.id && (
						<Button
							variant={isEditing ? "secondary" : "ghost"}
							size="icon"
							aria-label="Edit project"
							onClick={() => {
								console.log("Edit project", project.id);
								setIsEditing(!isEditing);
							}}
						>
							<PencilIcon className="w-6 h-6" />
						</Button>
					)}
					{project?.id && (
						<DeleteItem
							deleteItemId={project.id}
							actionFn={async (formData: FormData) =>
								await deleteProject(formData)
							}
							successFn={() => toggleProjectModal({ projectId: undefined })}
						/>
					)}
				</Flex>
			</Flex>
			{isEditing && (
				<Grid
					as="form"
					cols={2}
					gap={6}
					onSubmit={async (evt: FormEvent<HTMLFormElement>) => {
						evt.preventDefault();
						const formData = new FormData(evt.currentTarget);
						await updateProjectMutation.mutateAsync(formData);
						setIsEditing(false);
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
			)}
			{!isEditing && (
				<Grid cols={2} gap={6}>
					<P>{project?.description}</P>
					<P>
						Rate:{" "}
						{project?.rate_in_cents
							? `$${(project.rate_in_cents / 100).toFixed(2)}/hr`
							: "N/A"}
					</P>
					{project?.customerId && <P>Customer: {project?.customerId}</P>}
					<P>Active: {project?.active ? "Yes" : "No"}</P>
				</Grid>
			)}
			{project?.timesheets && project.timesheets.length > 0 && (
				<div className="mb-6">
					<H2 className="mt-8 mb-4">Timesheets</H2>
					{project?.timesheets.map((timesheet) => (
						<CardPreview
							key={timesheet.id}
							name={timesheet.name}
							description={timesheet.description ?? "No description provided"}
							action={() => {
								toggleProjectModal({ projectId: undefined });
								toggleTimesheetModal({ timesheetId: timesheet.id });
							}}
						/>
					))}
				</div>
			)}
			{project && <GenerateTimesheet project={project} />}
		</Dialog>
	);
};
