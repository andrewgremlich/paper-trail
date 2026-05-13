import "./globals.css";

import { useQueries } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { GenerateProject } from "@/components/features/projects/GenerateProject";
import { GenerateProjectDialog } from "@/components/features/projects/GenerateProjectDialog";
import { Flex } from "@/components/layout/Flex";
import { H1, H2, Main, Section } from "@/components/layout/HtmlElements";
import { CardPreview } from "@/components/shared/CardPreview";
import { Button } from "@/components/ui/Button";
import { getAllProjects, getAllTimesheets } from "@/lib/db";
import { getCustomers } from "@/lib/db/customers";
import { usePaperTrailStore } from "@/lib/store";

export const Timesheets = () => {
	const { openModal } = usePaperTrailStore();
	const [creatingProject, setCreatingProject] = useState(false);

	const [{ data: projects }, { data: timesheets }, { data: customers }] =
		useQueries({
			queries: [
				{ queryKey: ["projects"], queryFn: getAllProjects },
				{ queryKey: ["timesheets"], queryFn: getAllTimesheets },
				{ queryKey: ["customers"], queryFn: getCustomers },
			],
		});

	const hasData = (projects?.length ?? 0) > 0 || (timesheets?.length ?? 0) > 0;

	return (
		<Main>
			{timesheets && timesheets.length > 0 && (
				<>
					<H1>Timesheets</H1>
					{projects &&
						timesheets.map((timesheet) => (
							<CardPreview
								key={timesheet.id}
								name={`${timesheet.name} ${
									projects.find((p) => p.id === timesheet.projectId)?.name
										? `(${
												projects.find((p) => p.id === timesheet.projectId)?.name
											})`
										: ""
								}`}
								description={
									timesheet.description
										? timesheet.description
										: "No description provided"
								}
								action={() => {
									openModal({ type: "timesheet", timesheetId: timesheet.id });
								}}
								ariaLabel={`Open timesheet ${timesheet.name}`}
							/>
						))}
				</>
			)}

			{hasData ? (
				<Section aria-labelledby="projects-heading">
					<Flex
						justify="between"
						items="center"
						style={{ marginBottom: "1.5rem" }}
					>
						<H2 id="projects-heading" style={{ margin: 0 }}>
							Projects
						</H2>
						<Button
							type="button"
							variant="default"
							leftIcon={<FolderPlus size={16} />}
							onClick={() => setCreatingProject(true)}
						>
							New Project
						</Button>
					</Flex>
					{projects?.map((project) => (
						<CardPreview
							key={project.id}
							name={project.name}
							description={project.description ?? "No description provided"}
							action={() => {
								openModal({ type: "project", projectId: project.id });
							}}
							ariaLabel={`Open project ${project.name}`}
						/>
					))}
					<GenerateProjectDialog
						isOpen={creatingProject}
						customers={customers}
						onClose={() => setCreatingProject(false)}
						onSuccess={() => setCreatingProject(false)}
					/>
				</Section>
			) : (
				<Section aria-labelledby="projects-heading">
					<H2 id="projects-heading">New Project</H2>
					<GenerateProject customers={customers} />
				</Section>
			)}
		</Main>
	);
};
