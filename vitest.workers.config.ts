import path from "node:path";
import {
	cloudflareTest,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations(
	path.join(__dirname, "api/db/migrations"),
);

export default defineConfig({
	plugins: [
		cloudflareTest({
			singleWorker: true,
			main: "./api/src/index.ts",
			miniflare: {
				compatibilityDate: "2026-03-12",
				compatibilityFlags: ["nodejs_compat"],
				d1Databases: ["DB"],
				r2Buckets: ["FILES_BUCKET"],
				bindings: {
					TEST_MIGRATIONS: migrations,
					ENCRYPTION_KEY:
						"/7AvL1XrTES6cEip7rWUcx5k4gv+MhfgEhbPmJdoWoQ=",
					APP_BASE_URL: "http://localhost:5173",
					CLERK_BYPASS: "true",
					CLERK_DEV_USER_ID: "user_test_dev",
					CLERK_DEV_EMAIL: "test@localhost.dev",
					RESEND_API_KEY: "re_test_dummy",
					RESEND_FROM_ADDRESS: "Test <test@example.com>",
				},
			},
		}),
	],
	test: {
		name: "workers",
		include: ["api/src/**/*.workers.test.ts"],
		setupFiles: ["./api/src/test/applyMigrations.ts"],
	},
});
