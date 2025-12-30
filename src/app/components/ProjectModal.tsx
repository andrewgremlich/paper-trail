import { useQuery } from "@tanstack/react-query";
import { deleteProject, getProjectById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { CardPreview } from "./CardPreview";
import { DeleteItem } from "./DeleteItem";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { GenerateTimesheet } from "./GenerateTimesheet";
import { H2, P } from "./HtmlElements";

export const ProjectModal = () => {
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

	return (
		<Dialog
			className="px-10 py-8"
			variant="liquidGlass"
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
		>
			<Flex className="w-full" justify="between" items="start">
				<H2>{project?.name}</H2>
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
			<Flex gap={4} justify="between">
				<div>
					<P>
						Started:{" "}
						{project?.createdAt
							? new Date(project?.createdAt).toLocaleDateString()
							: "N/A"}
					</P>
					<P>
						Rate:{" "}
						{project?.rate_in_cents
							? `$${(project.rate_in_cents / 100).toFixed(2)}/hr`
							: "N/A"}
					</P>
					<P>Active: {project?.active ? "Yes" : "No"}</P>
				</div>
				<div>
					<P>{project?.description}</P>
					{project?.customerId && <P>Customer: {project?.customerId}</P>}
				</div>
			</Flex>
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
