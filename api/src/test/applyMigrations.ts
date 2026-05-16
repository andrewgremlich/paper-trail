import { applyD1Migrations, env } from "cloudflare:test";

// biome-ignore lint/suspicious/noExplicitAny: test-only bindings extended on Env at miniflare config time
const testEnv = env as any;

await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
