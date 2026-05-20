import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

function loadDevVars(): Record<string, string> {
	try {
		const raw = readFileSync(".dev.vars", "utf-8");
		return Object.fromEntries(
			raw
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"))
				.map((line) => {
					const eq = line.indexOf("=");
					return [line.slice(0, eq).trim(), line.slice(eq + 1).trim()];
				}),
		);
	} catch {
		return {};
	}
}

const devVars = loadDevVars();

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [react(), cloudflare()],
	define: {
		"import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(
			devVars.VITE_CLERK_PUBLISHABLE_KEY ?? "",
		),
		"import.meta.env.VITE_CLERK_BYPASS": JSON.stringify(
			devVars.CLERK_BYPASS ?? "",
		),
	},
});
