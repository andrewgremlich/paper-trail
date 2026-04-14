import type { Context, Next } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";

export type AuthVariables = {
	userId: number;
	userEmail: string;
};

/**
 * Middleware that extracts the authenticated user identity from Cloudflare Access headers.
 * Cloudflare Access injects `Cf-Access-Authenticated-User-Email` after verifying
 * the user's GitHub OAuth session.
 *
 * In development, set CF_ACCESS_BYPASS=true and CF_ACCESS_DEV_EMAIL to skip Access validation.
 */
export async function cfAccessAuth(
	c: Context<{ Bindings: Env; Variables: AuthVariables }>,
	next: Next,
) {
	const env = c.env;
	let email: string | null = null;

	// In development, allow bypassing Cloudflare Access
	if (env.CF_ACCESS_BYPASS === "true") {
		email = env.CF_ACCESS_DEV_EMAIL || "dev@localhost";
	} else {
		email = c.req.header("Cf-Access-Authenticated-User-Email") ?? null;
	}

	if (!email) {
		return c.json(
			{ error: "Unauthorized: no Cloudflare Access identity" },
			401,
		);
	}

	const db = getDb(env);

	// INSERT OR IGNORE is atomic — concurrent requests won't race-insert duplicates.
	// If the row already exists the insert is silently skipped; we always SELECT after.
	await db
		.prepare("INSERT OR IGNORE INTO users (uuid, email) VALUES (?, ?)")
		.bind(crypto.randomUUID(), email)
		.run();

	const user = await db
		.prepare("SELECT id FROM users WHERE email = ?")
		.bind(email)
		.first<{ id: number }>();

	if (!user) {
		return c.json({ error: "Failed to resolve user identity" }, 500);
	}

	c.set("userId", user.id);
	c.set("userEmail", email);
	return next();
}
