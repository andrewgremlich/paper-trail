import "./globals.css";

import { useQuery } from "@tanstack/react-query";

// import { invoke } from "@tauri-apps/api/core";

import { GenerateProject } from "@/components/features/projects/GenerateProject";
import { H1, H2, Main, P, Section } from "@/components/layout/HtmlElements";
import { CardPreview } from "@/components/shared/CardPreview";
import { getAllProjects, getAllTimesheets } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { getAllCustomers } from "@/lib/stripeApi";
import styles from "./Page.module.css";

export const Timesheets = () => {
	const { toggleProjectModal, toggleTimesheetModal } = usePaperTrailStore();
	const { data: projects } = useQuery({
		queryKey: ["projects"],
		queryFn: getAllProjects,
	});
	const { data: timesheets } = useQuery({
		queryKey: ["timesheets"],
		queryFn: getAllTimesheets,
	});
	const { data: customers } = useQuery({
		queryKey: ["customers"],
		queryFn: async () => {
			return await getAllCustomers(50);
		},
	});

	// TODO: potentially keep for seeing how to call Tauri commands
	// const [greetMsg, setGreetMsg] = useState("");
	// const [name, setName] = useState("");

	// async function greet() {
	// 	// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
	// 	setGreetMsg(await invoke("greet", { name }));
	// }

	return (
		<Main className={styles.container}>
			<H1>Paper Trail</H1>
			{/* <input
				onChange={(e) => setName(e.currentTarget.value)}
				placeholder="Enter a name..."
			/>
			<button type="button" onClick={greet}>
				Greet
			</button>
			<p>{greetMsg}</p> */}
			<P>
				A Paper Trail that integrates with Stripe in order to send invoices.
			</P>

			{timesheets && timesheets.length > 0 && (
				<Section>
					<H2>All Timesheets</H2>

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
				</Section>
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
