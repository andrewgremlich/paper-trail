import { type Client, createClient } from "@libsql/client";
import type { Env } from "./types";

let client: Client | null = null;

export function getDb(env: Env): Client {
	if (!client) {
		client = createClient({
			url: env.TURSO_DATABASE_URL,
			authToken: env.TURSO_AUTH_TOKEN,
		});
	}
	return client;
}
