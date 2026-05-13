import type { Context, Next } from "hono";
import {
	AccessJwtError,
	getAccessConfig,
	verifyAccessJwt,
} from "../lib/cfAccessJwt";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";

export type AuthVariables = {
	userId: number;
	userEmail: string;
};

/**
 * Middleware that resolves the authenticated user identity for a request.
 *
 * Cloudflare Access fronts this Worker. Access mints a per-request RS256
 * JWT (header `Cf-Access-Jwt-Assertion`) and *also* echoes the identity in
 * `Cf-Access-Authenticated-User-Email`. We **must** verify the JWT — the
 * header on its own is spoofable by anyone who can reach the Worker URL
 * directly (workers.dev preview URL, internal LAN, etc.). Without
 * verification, the entire app is exposed to anyone with a TCP socket.
 *
 * Production:
 * - Reads `Cf-Access-Jwt-Assertion`, verifies signature against the team's
 *   JWKS, and checks `iss` + `aud` + `exp`. The `email` claim is the
 *   source of truth.
 * - Refuses to start if `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` are
 *   not set — fail closed.
 *
 * Development:
 * - `CF_ACCESS_BYPASS=true` short-circuits the verification and uses
 *   `CF_ACCESS_DEV_EMAIL` (`dev@localhost` if unset) so `pnpm run dev`
 *   works without an Access tunnel.
 */
export async function cfAccessAuth(
	c: Context<{ Bindings: Env; Variables: AuthVariables }>,
	next: Next,
) {
	const env = c.env;
	let email: string | null = null;

	if (env.CF_ACCESS_BYPASS === "true") {
		email = env.CF_ACCESS_DEV_EMAIL || "dev@localhost";
	} else {
		let config: { teamDomain: string; aud: string } | null;
		try {
			config = getAccessConfig(env);
		} catch (err) {
			if (err instanceof AccessJwtError) {
				console.error("Access config error", { reason: err.reason });
				return c.json(
					{ error: "Authentication is misconfigured on the server" },
					500,
				);
			}
			throw err;
		}

		if (!config) {
			// Neither bypass nor JWT config — fail closed.
			console.error(
				"Access config missing — set CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD, or CF_ACCESS_BYPASS=true for dev",
			);
			return c.json(
				{ error: "Authentication is not configured on the server" },
				500,
			);
		}

		const token = c.req.header("Cf-Access-Jwt-Assertion");
		if (!token) {
			return c.json({ error: "Unauthorized: no Access JWT" }, 401);
		}

		try {
			const claims = await verifyAccessJwt(token, config.teamDomain, config.aud);
			email = claims.email;
		} catch (err) {
			if (err instanceof AccessJwtError) {
				// Log the reason for diagnostics but never reflect it to the
				// client — it would help an attacker tune a forgery attempt.
				console.warn("Access JWT rejected", { reason: err.reason });
				return c.json({ error: "Unauthorized" }, 401);
			}
			throw err;
		}
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
