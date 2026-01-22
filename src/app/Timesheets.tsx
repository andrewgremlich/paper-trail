import "./globals.css";

import { useQueries } from "@tanstack/react-query";

import { GenerateProject } from "@/components/features/projects/GenerateProject";
import { H1, H2, Main, Section } from "@/components/layout/HtmlElements";
import { CardPreview } from "@/components/shared/CardPreview";
import { getAllProjects, getAllTimesheets } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { getAllCustomers } from "@/lib/stripeApi";
import styles from "./Page.module.css";

export const Timesheets = () => {
  const { toggleProjectModal, toggleTimesheetModal } = usePaperTrailStore();
  const [{ data: projects }, { data: timesheets }, { data: customers }] =
    useQueries({
      queries: [
        { queryKey: ["projects"], queryFn: getAllProjects },
        { queryKey: ["timesheets"], queryFn: getAllTimesheets },
        { queryKey: ["customers"], queryFn: () => getAllCustomers(50) },
      ],
    });

  return (
    <Main className={styles.container}>
      {timesheets && timesheets.length > 0 && (
        <>
          <H1>All Timesheets</H1>

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
                    ? `${timesheet.description} (#${timesheet.id})`
                    : "No description provided"
                }
                action={() => {
                  toggleTimesheetModal({ timesheetId: timesheet.id });
                }}
              />
            ))}
        </>
      )}

      {projects && projects.length > 0 && (
        <Section>
          <H2>Projects</H2>
          {projects.map((project) => (
            <CardPreview
              key={project.id}
              name={project.name}
              description={project.description ?? "No description provided"}
              action={() => {
                toggleProjectModal({ projectId: project.id });
              }}
            />
          ))}
        </Section>
      )}

      <Section>
        <H2>New Project</H2>
        <GenerateProject customers={customers} />
      </Section>
    </Main>
  );
};
