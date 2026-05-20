import type { Context, Next } from "hono";
import { fetchClerkUser } from "../lib/clerkApi";
import {
	ClerkJwtError,
	getClerkConfig,
	verifyClerkJwt,
} from "../lib/clerkJwt";
import { loadUserDek, provisionUserDek } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";

export type AuthVariables = {
	userId: number;
	userEmail: string;
	clerkUserId: string;
	// Set when the user has a DEK provisioned. `null` while the
	// per-user-DEK rollout is gated off or before the user has been
	// backfilled — handlers fall through to the legacy single-key
	// `encrypt(x, env)` path in that case.
	dek: CryptoKey | null;
};

/**
 * Middleware that resolves the authenticated user identity for a request.
 *
 * Clerk fronts the frontend. The browser exchanges credentials (GitHub
 * OAuth, or any other configured strategy) for a Clerk session, and
 * `@clerk/react` then attaches the short-lived session JWT to every
 * API request via `Authorization: Bearer <token>`.
 *
 * Production:
 * - Verify the JWT against Clerk's JWKS (or `CLERK_JWT_KEY` PEM for
 *   networkless verification). Checks `iss`, `azp` (optional), `exp`/`nbf`.
 * - `sub` is the stable Clerk user id; it is the source of truth for who
 *   the user is. Email/display-name are pulled from the Clerk Backend API
 *   on the first sign-in and cached in the local D1 `users` row.
 * - Refuses to start if `CLERK_ISSUER` is not set — fail closed.
 *
 * Development:
 * - `CLERK_BYPASS=true` short-circuits verification and uses
 *   `CLERK_DEV_USER_ID` / `CLERK_DEV_EMAIL` (defaults provided) so
 *   `pnpm run dev` works without a Clerk instance.
 */
export async function clerkAuth(
	c: Context<{ Bindings: Env; Variables: AuthVariables }>,
	next: Next,
) {
	const env = c.env;
	let clerkUserId: string | null = null;
	let bypassEmail: string | null = null;
	let bypassDisplayName: string | null = null;

	if (env.CLERK_BYPASS === "true") {
		// Refuse to engage the bypass on anything that doesn't look like a
		// dev / preview origin. Prevents `.dev.vars` settings from opening
		// production auth if they ever leak into a `wrangler deploy`.
		const base = env.APP_BASE_URL ?? "";
		const looksDev =
			base.startsWith("http://localhost") ||
			base.startsWith("http://127.0.0.1") ||
			base.includes(".workers.dev");
		if (!looksDev) {
			console.error("CLERK_BYPASS=true rejected — not a dev origin", {
				base,
			});
			return c.json({ error: "Authentication is misconfigured" }, 500);
		}
		clerkUserId = env.CLERK_DEV_USER_ID || "user_dev_localhost";
		bypassEmail = env.CLERK_DEV_EMAIL || "dev@localhost";
		bypassDisplayName = "Dev User";
	} else {
		// Outside of bypass mode, missing ENCRYPTION_KEY would silently
		// store every sensitive column and R2 file body in plaintext.
		// Fail closed: a missing key is a deployment bug.
		if (!env.ENCRYPTION_KEY) {
			console.error("ENCRYPTION_KEY missing in production deploy");
			return c.json({ error: "Server is misconfigured" }, 500);
		}
		let config: ReturnType<typeof getClerkConfig>;
		try {
			config = getClerkConfig(env);
		} catch (err) {
			if (err instanceof ClerkJwtError) {
				console.error("Clerk config error", { reason: err.reason });
				return c.json(
					{ error: "Authentication is misconfigured on the server" },
					500,
				);
			}
			throw err;
		}

		if (!config) {
			console.error(
				"Clerk config missing — set CLERK_ISSUER (+ CLERK_SECRET_KEY), or CLERK_BYPASS=true for dev",
			);
			return c.json(
				{ error: "Authentication is not configured on the server" },
				500,
			);
		}

		const header = c.req.header("Authorization") || "";
		const match = /^Bearer\s+(.+)$/i.exec(header);
		if (!match) {
			return c.json({ error: "Unauthorized: no bearer token" }, 401);
		}
		const token = match[1].trim();

		try {
			const claims = await verifyClerkJwt(token, config);
			clerkUserId = claims.sub;
		} catch (err) {
			if (err instanceof ClerkJwtError) {
				// Log the reason for diagnostics but never reflect it to the
				// client — would help an attacker tune a forgery.
				console.warn("Clerk JWT rejected", { reason: err.reason });
				return c.json({ error: "Unauthorized" }, 401);
			}
			throw err;
		}
	}

	if (!clerkUserId) {
		return c.json({ error: "Unauthorized: no Clerk identity" }, 401);
	}

	const db = getDb(env);

	// Fast path: row already provisioned for this clerk user.
	let user = await db
		.prepare("SELECT id, email FROM users WHERE clerkUserId = ?")
		.bind(clerkUserId)
		.first<{ id: number; email: string }>();

	if (!user) {
		// First sign-in for this clerk user. We need their email + display
		// name to materialise the local row. Either Clerk gives them to us
		// (production), or the bypass path supplied them (dev).
		let email = bypassEmail;
		let displayName = bypassDisplayName ?? "";

		if (!email) {
			try {
				const fetched = await fetchClerkUser(clerkUserId, env);
				email = fetched.email;
				displayName = fetched.displayName;
			} catch (err) {
				console.error("Failed to fetch Clerk user details", err);
				return c.json(
					{ error: "Failed to resolve user identity" },
					500,
				);
			}
		}

		// Backward-compatible upsert path:
		//   1. If a legacy row (pre-Clerk, identified by email) exists,
		//      patch it with this clerkUserId so the user inherits their
		//      data. UPDATE ... WHERE clerkUserId IS NULL keeps it safe
		//      against re-signups under a recycled email.
		//   2. Otherwise INSERT OR IGNORE creates the row. We then SELECT
		//      either way.
		const patched = await db
			.prepare(
				`UPDATE users SET clerkUserId = ?, displayName = CASE WHEN displayName = '' THEN ? ELSE displayName END
				 WHERE email = ? AND clerkUserId IS NULL`,
			)
			.bind(clerkUserId, displayName, email)
			.run();

		if (!patched.meta.changes) {
			await db
				.prepare(
					"INSERT OR IGNORE INTO users (uuid, email, displayName, clerkUserId) VALUES (?, ?, ?, ?)",
				)
				.bind(crypto.randomUUID(), email, displayName, clerkUserId)
				.run();
		}

		user = await db
			.prepare("SELECT id, email FROM users WHERE clerkUserId = ?")
			.bind(clerkUserId)
			.first<{ id: number; email: string }>();
	}

	if (!user) {
		return c.json({ error: "Failed to resolve user identity" }, 500);
	}

	c.set("userId", user.id);
	c.set("userEmail", user.email);
	c.set("clerkUserId", clerkUserId);

	// Per-user DEK resolution. Gated by DEK_MIGRATION_ENABLED so the
	// rollout is incremental: with the flag off, every user appears
	// un-migrated and handlers use the legacy single-key path. With
	// the flag on, missing DEKs are minted lazily — but row
	// ciphertext is *not* rewritten here; that happens via the
	// dedicated migration worker so request latency stays bounded.
	let dek: CryptoKey | null = null;
	try {
		if (env.DEK_MIGRATION_ENABLED === "true") {
			dek = await loadUserDek(user.id, env);
			if (!dek) {
				dek = await provisionUserDek(user.id, env);
				if (!dek) {
					// Lost the provisioning race with a concurrent request;
					// fetch the value the winner persisted.
					dek = await loadUserDek(user.id, env);
				}
			}
		}
		// When DEK_MIGRATION_ENABLED is false, dek stays null — all handlers
		// fall through to the legacy single-key path via `c.get("dek") ?? c.env`.
	} catch (err) {
		// DEK resolution failure must not 500 the request — fall back
		// to legacy single-key path. We still log so a misconfigured
		// KEK rotation is visible.
		console.error("DEK resolution failed", err);
		dek = null;
	}
	c.set("dek", dek);

	return next();
}
