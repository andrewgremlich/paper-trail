import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@/components": resolve(__dirname, "src/app/components"),
			"@/lib": resolve(__dirname, "src/app/lib"),
			"@": resolve(__dirname, "src/app"),
		},
	},
	test: {
		environment: "happy-dom",
	},
});
