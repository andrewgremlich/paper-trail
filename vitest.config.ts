import { defineConfig } from "vitest/config";

// Root vitest config — composes two sub-projects:
//   - vitest.config.node.ts: happy-dom for the React frontend + pure unit tests
//   - vitest.workers.config.ts: workerd via @cloudflare/vitest-pool-workers
//     for backend end-to-end tests that exercise the real Hono app + D1 + R2
export default defineConfig({
	test: {
		projects: ["./vitest.config.node.ts", "./vitest.workers.config.ts"],
	},
});
