import { useQuery } from "@tanstack/react-query";
import { BaseDirectory, mkdir, readDir } from "@tauri-apps/plugin-fs";
import { useEffect } from "react";
import sanitize from "sanitize-filename";

import { H1 } from "./components/HtmlElements";
import ProjectFiles from "./components/ProjectFiles";
import { getAllProjects } from "./lib/db";

export const FileStorage = () => {
	const { data: allProjects } = useQuery({
		queryKey: ["allProjects"],
		queryFn: async () => {
			const projects = await getAllProjects();
			return projects;
		},
	});

	// Ensure the base folder and per-project folders exist in the user's Documents.
	useEffect(() => {
		const ensureFolders = async (): Promise<void> => {
			try {
				// Create base `paper-trail` directory in Documents
				await mkdir("paper-trail", {
					baseDir: BaseDirectory.Document,
					recursive: true,
				});

				// Create a folder for each project
				if (Array.isArray(allProjects)) {
					for (const project of allProjects) {
						const folderName = sanitize(project.name);
						const projectDir = `paper-trail/${folderName}`;
						await mkdir(projectDir, {
							baseDir: BaseDirectory.Document,
							recursive: true,
						});
					}
				}

				// Optional: log contents of the base directory for visibility
				const entries = await readDir("paper-trail", {
					baseDir: BaseDirectory.Document,
				});
				console.log("paper-trail directory entries:", entries);
			} catch (error) {
				console.error("Error ensuring project folders:", error);
			}
		};

		ensureFolders();
	}, [allProjects]);

	return (
		<div className="space-y-6">
			<H1>Storage</H1>
			{Array.isArray(allProjects) && allProjects.length > 0 ? (
				allProjects.map((p) => <ProjectFiles key={p.id} projectName={p.name} />)
			) : (
				<div className="text-slate-600">No projects found.</div>
			)}
		</div>
	);
};
