import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { deleteProject, getProjectById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { CardPreview } from "./CardPreview";
import { DeleteItem } from "./DeleteItem";
import { Dialog } from "./Dialog";
import { EditToggleButton } from "./EditToggleButton";
import { Flex } from "./Flex";
import { GenerateTimesheet } from "./GenerateTimesheet";
import { Grid } from "./Grid";
import { H2, P } from "./HtmlElements";
import { ProjectEditForm } from "./ProjectEditForm";

export const ProjectModal = () => {
	const [isEditing, setIsEditing] = useState(false);
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
	// editing logic moved to ProjectEditForm

	return (
		<Dialog
			className="px-10 py-8"
			variant="liquidGlass"
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
		>
			<Flex className="w-full" justify="between" items="start">
				<H2>{project?.name}</H2>
				{/* TODO: abstract editing so it's reusable */}
				<Flex gap={2} items="center">
					<EditToggleButton
						enabled={!!project?.id}
						isEditing={isEditing}
						ariaLabel="Edit project"
						onToggle={() => {
							if (project?.id) {
								console.log("Edit project", project.id);
							}
							setIsEditing(!isEditing);
						}}
					/>
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
			{isEditing && project && (
				<ProjectEditForm
					project={project}
					onSaved={() => setIsEditing(false)}
				/>
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
