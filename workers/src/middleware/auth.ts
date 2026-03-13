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
export async function cfAccessAuth(c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) {
	const env = c.env;
	let email: string | null = null;

	// In development, allow bypassing Cloudflare Access
	if (env.CF_ACCESS_BYPASS === "true") {
		email = env.CF_ACCESS_DEV_EMAIL || "dev@localhost";
	} else {
		email = c.req.header("Cf-Access-Authenticated-User-Email") ?? null;
	}

	if (!email) {
		return c.json({ error: "Unauthorized: no Cloudflare Access identity" }, 401);
	}

	const db = getDb(env);

	// Find existing user by email
	const existing = await db.execute({
		sql: "SELECT id, email FROM user_profile WHERE email = ?",
		args: [email],
	});

	if (existing.rows.length > 0) {
		c.set("userId", existing.rows[0].id as number);
		c.set("userEmail", email);
		return next();
	}

	// Create new user from Cloudflare Access identity
	const uuid = crypto.randomUUID();
	await db.execute({
		sql: "INSERT INTO user_profile (uuid, email) VALUES (?, ?)",
		args: [uuid, email],
	});

	const created = await db.execute({
		sql: "SELECT id FROM user_profile WHERE email = ?",
		args: [email],
	});

	c.set("userId", created.rows[0].id as number);
	c.set("userEmail", email);
	return next();
}
