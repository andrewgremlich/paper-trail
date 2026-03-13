import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
	console.error(
		"Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables.",
	);
	console.error(
		"Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx workers/scripts/seed.ts",
	);
	process.exit(1);
}

const client = createClient({ url, authToken });

const seedPath = resolve(__dirname, "../db/seed.sql");
const sql = readFileSync(seedPath, "utf-8");

// Remove comment-only lines
const cleaned = sql
	.split("\n")
	.filter((line) => !line.trim().startsWith("--"))
	.join("\n")
	.trim();

console.log(`Seeding database at ${url}...`);

try {
	await client.executeMultiple(cleaned);
	console.log("Database seeded successfully.");
} catch (err) {
	console.error("Failed to seed database:\n");
	console.error(err);
	process.exit(1);
}

client.close();
