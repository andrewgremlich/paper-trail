import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [react(), cloudflare()],
});
