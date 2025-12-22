import "./globals.css";

import { useQuery } from "@tanstack/react-query";
// import { invoke } from "@tauri-apps/api/core";

import { CardPreview } from "@/components/CardPreview";
import { GenerateProject } from "@/components/GenerateProject";
import { H1, H2, P, Section } from "@/components/HtmlElements";
import { getAllProjects, getAllTimesheets } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { getAllCustomers } from "@/lib/stripeHttpClient";
import { getStripeSecretKey } from "@/lib/stronghold";

export const Timesheet = () => {
	const { toggleProjectModal, toggleTimesheetModal } = usePaperTrailStore();
	const { data: dashboardData } = useQuery({
		queryKey: ["dashboardData"],
		queryFn: async () => {
			const [projects, timesheets] = await Promise.all([
				getAllProjects(),
				getAllTimesheets(),
			]);
			return { projects, timesheets };
		},
	});
	const { data: customers } = useQuery({
		queryKey: ["customers"],
		queryFn: async () => {
			const key = await getStripeSecretKey();
			if (key) {
				return getAllCustomers(key, 500);
			}
			return [];
		},
	});

	// const [greetMsg, setGreetMsg] = useState("");
	// const [name, setName] = useState("");

	// async function greet() {
	// 	// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
	// 	setGreetMsg(await invoke("greet", { name }));
	// }

	return (
		<>
			<H1>Paper Trail</H1>
			{/* <input
				onChange={(e) => setName(e.currentTarget.value)}
				placeholder="Enter a name..."
			/>
			<button type="button" onClick={greet}>
				Greet
			</button>
			<p>{greetMsg}</p> */}
			<Section>
				<P>
					A Paper Trail that integrates with Stripe in order to send invoices.
				</P>
			</Section>

			{dashboardData && dashboardData.timesheets.length > 0 && (
				<Section>
					<H2>All Timesheets</H2>

					{dashboardData.timesheets.map((timesheet) => (
						<CardPreview
							key={timesheet.id}
							name={timesheet.name}
							description={timesheet.description ?? "No description provided"}
							action={() => {
								toggleTimesheetModal({ timesheetId: timesheet.id });
							}}
						/>
					))}
				</Section>
			)}

			{dashboardData && dashboardData.projects.length > 0 && (
				<Section>
					<H2>Projects</H2>
					{dashboardData.projects.map((project) => (
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
		</>
	);
};
