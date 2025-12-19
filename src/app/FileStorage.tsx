import { BaseDirectory, readDir } from "@tauri-apps/plugin-fs";
import { useEffect } from "react";
import { H1 } from "./components/HtmlElements";

export const FileStorage = () => {
	useEffect(() => {
		readDir("", { baseDir: BaseDirectory.AppData })
			.then((entries) => {
				console.log("Directory entries:", entries);
			})
			.catch((error) => {
				console.error("Error reading directory:", error);
			});

		readDir("", { baseDir: BaseDirectory.Document })
			.then((entries) => {
				console.log("Document Directory entries:", entries);
			})
			.catch((error) => {
				console.error("Error reading Document directory:", error);
			});
	}, []);

	return (
		<>
			<H1>Storage</H1>
		</>
	);
};
