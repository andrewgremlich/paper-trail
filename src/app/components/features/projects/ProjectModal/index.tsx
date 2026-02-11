import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { GenerateTimesheet } from "@/components/features/timesheets/GenerateTimesheet";
import { Flex } from "@/components/layout/Flex";
import { H2, P } from "@/components/layout/HtmlElements";
import { CardPreview } from "@/components/shared/CardPreview";
import { DeleteItem } from "@/components/shared/DeleteItem";
import { EditToggleButton } from "@/components/shared/EditToggleButton";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { deleteProject, getProjectById } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { ProjectEditForm } from "../ProjectEditForm";
import styles from "./styles.module.css";

export const ProjectModal = () => {
	const [isEditing, setIsEditing] = useState(false);
	const headingId = useId();
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
			variant="liquidGlass"
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
			titleId={headingId}
		>
			<Flex className={styles.header} justify="between" items="start">
				<H2 id={headingId}>{project?.name}</H2>
				<Flex gap={2} items="center">
					<EditToggleButton
						enabled={!!project?.id}
						isEditing={isEditing}
						ariaLabel="Edit project"
						onToggle={() => {
							setIsEditing(!isEditing);
						}}
					/>
					{project?.id && (
						<DeleteItem
							deleteItemId={project.id}
							actionFn={async (formData: FormData) => {
								const id = Number(formData.get("id") || 0);
								await deleteProject(id);
							}}
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
				<Grid cols={2} columnGap={24}>
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
				<div className={styles.timesheetsSection}>
					<H2 className={styles.timesheetsHeading}>Timesheets</H2>
					{project?.timesheets.map((timesheet) => (
						<CardPreview
							key={timesheet.id}
							name={timesheet.name}
							description={timesheet.description ?? "No description provided"}
							action={() => {
								toggleProjectModal({ projectId: undefined });
								setTimeout(() => {
									toggleTimesheetModal({ timesheetId: timesheet.id });
								}, 160);
							}}
						/>
					))}
				</div>
			)}
			{project && <GenerateTimesheet project={project} />}
		</Dialog>
	);
};
