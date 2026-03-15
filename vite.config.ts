import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [tsconfigPaths(), react(), cloudflare()],
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
});