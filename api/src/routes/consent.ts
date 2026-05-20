import { Hono } from "hono";
import { decrypt, encrypt, loadUserDek } from "../lib/crypto";
import {
	CSRF_FIELD,
	csrfFormField,
	issueCsrfToken,
	validateCsrfToken,
} from "../lib/csrf";
import { getDb } from "../lib/db";
import { hmacSha256Hex } from "../lib/hash";
import type { Env } from "../lib/types";

/**
 * Public (unauthenticated) consent confirmation routes.
 *
 * The customer clicks a single-use token link in an email and is shown
 * an Agree/Decline page. Tokens expire 30 days after they were issued
 * and are cleared on first use.
 *
 * Mounted on the top-level `app`, NOT under /api/v1 — these are public
 * so the customer (who is not a Cloudflare Access user) can reach them.
 */

const app = new Hono<{ Bindings: Env }>();

// Mirror of the encryption-key guard in clerkAuth. These routes
// decrypt() customer rows + audit-log payloads; without a key, a
// misdeployed Worker would serve plaintext rows as if they were
// encrypted.
app.use("/*", async (c, next) => {
	if (c.env.CLERK_BYPASS !== "true" && !c.env.ENCRYPTION_KEY) {
		console.error("ENCRYPTION_KEY missing in production deploy");
		return c.json({ error: "Server is misconfigured" }, 500);
	}
	return next();
});

const CONSENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Headers applied to every public consent page. `no-referrer` keeps the
// single-use consent/revoke token from leaking via Referer to any link
// the customer might follow off the page.
const PUBLIC_PAGE_HEADERS = {
	"Cache-Control": "no-store",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	// CSP for the consent pages. No inline or external scripts — the form
	// is a plain POST. Inline styles are unavoidable in the small page
	// template, so `style-src 'unsafe-inline'` is the price.
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
} as const;

const escape = (value: string | null | undefined): string => {
	if (value == null) return "";
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
};

const page = (title: string, body: string): string =>
	`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<meta name="referrer" content="no-referrer" />
<title>${escape(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 48px 12px; }
  .card { max-width: 520px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h1 { margin-top: 0; font-size: 22px; }
  p { line-height: 1.6; }
  form { display: inline; }
  button { font: inherit; padding: 12px 20px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; }
  .agree { background: #1a1a1a; color: #fff; margin-right: 8px; }
  .decline { background: #f1f1f1; color: #1a1a1a; }
  .muted { color: #666; font-size: 13px; margin-top: 24px; }
</style>
</head><body><div class="card">${body}</div></body></html>`;

type ConsentRow = {
	id: string;
	userId: number;
	name: string;
	email: string;
	consentToken: string;
	consentRequestedAt: string | null;
};

const lookupValidToken = async (
	token: string,
	env: Env,
): Promise<ConsentRow | null> => {
	const db = getDb(env);
	const row = await db
		.prepare(
			`SELECT id, userId, name, email, consentToken, consentRequestedAt
			 FROM customers WHERE consentToken = ?`,
		)
		.bind(token)
		.first<ConsentRow>();
	if (!row) return null;
	const requestedMs = row.consentRequestedAt
		? Date.parse(row.consentRequestedAt)
		: 0;
	if (!requestedMs || Date.now() - requestedMs > CONSENT_TTL_MS) return null;
	return row;
};

// GET /consent/:token — show the Agree / Decline page
app.get("/:token", async (c) => {
	const token = c.req.param("token");
	const row = await lookupValidToken(token, c.env);
	if (!row) {
		return c.html(
			page(
				"Link expired",
				`<h1>This link is no longer valid</h1>
				 <p>Consent links expire after 30 days or once they've been used. Please ask the sender for a new link.</p>`,
			),
			410,
			PUBLIC_PAGE_HEADERS,
		);
	}

	const dek = await loadUserDek(row.userId, c.env);
	const enc = dek ?? c.env;
	const db = getDb(c.env);
	const userRow = await db
		.prepare("SELECT businessName FROM users WHERE id = ?")
		.bind(row.userId)
		.first<{ businessName: string | null }>();
	const businessName = userRow?.businessName
		? await decrypt(userRow.businessName, enc)
		: "The sender";

	const customerEmail = await decrypt(row.email, enc);

	const csrf = issueCsrfToken(c, "consent");
	return c.html(
		page(
			"Consent to electronic invoicing",
			`<h1>Consent to receive invoices by email</h1>
			 <p><strong>${escape(businessName)}</strong> would like to send invoices to <strong>${escape(customerEmail)}</strong>.</p>
			 <p>By agreeing, you confirm you're okay receiving invoices and payment links at this email address. You can revoke this at any time using the unsubscribe link included in every invoice.</p>
			 <form method="POST" action="/consent/${escape(token)}">
			   ${csrfFormField(csrf)}
			   <button class="agree" type="submit" name="decision" value="agree">I agree</button>
			   <button class="decline" type="submit" name="decision" value="decline">No, thanks</button>
			 </form>
			 <p class="muted">If you weren't expecting this, you can safely close this page — no email will be sent without your consent.</p>`,
		),
		200,
		PUBLIC_PAGE_HEADERS,
	);
});

// POST /consent/:token — flip the flag (or decline)
app.post("/:token", async (c) => {
	const token = c.req.param("token");
	const row = await lookupValidToken(token, c.env);
	if (!row) {
		return c.html(
			page(
				"Link expired",
				`<h1>This link is no longer valid</h1>
				 <p>Consent links expire after 30 days or once they've been used.</p>`,
			),
			410,
			PUBLIC_PAGE_HEADERS,
		);
	}

	const form = await c.req.parseBody();
	if (!validateCsrfToken(c, "consent", form[CSRF_FIELD])) {
		return c.html(
			page(
				"Session expired",
				`<h1>Session expired</h1>
				 <p>This consent page is no longer valid. Please open the consent link again from your email.</p>`,
			),
			403,
			PUBLIC_PAGE_HEADERS,
		);
	}
	const decision = form.decision === "agree" ? "agree" : "decline";

	const dek = await loadUserDek(row.userId, c.env);
	const enc = dek ?? c.env;
	const db = getDb(c.env);
	const ip =
		c.req.header("CF-Connecting-IP") ||
		c.req.header("X-Forwarded-For") ||
		"";
	const ua = c.req.header("User-Agent") ?? "";
	const ipHash = ip ? await hmacSha256Hex(ip, c.env) : null;
	const uaHash = ua ? await hmacSha256Hex(ua, c.env) : null;
	const now = new Date().toISOString();

	if (decision === "agree") {
		await db
			.prepare(
				`UPDATE customers
				 SET consentToEmailInvoices = 1, consentedAt = ?,
				     consentIpHash = ?, consentUaHash = ?,
				     consentToken = NULL
				 WHERE id = ?`,
			)
			.bind(now, ipHash, uaHash, row.id)
			.run();

		await db
			.prepare(
				`INSERT INTO customer_events (id, customerId, userId, type, payload)
				 VALUES (?, ?, ?, 'consent_granted', ?)`,
			)
			.bind(
				crypto.randomUUID(),
				row.id,
				row.userId,
				await encrypt(
					JSON.stringify({
						v: 2,
						ipHash,
						uaHash,
					}),
					enc,
				),
			)
			.run();

		return c.html(
			page(
				"Consent recorded",
				`<h1>Thanks — consent recorded</h1>
				 <p>You'll receive invoices at this email address. You can revoke consent at any time using the unsubscribe link included in every invoice.</p>`,
			),
			200,
			PUBLIC_PAGE_HEADERS,
		);
	}

	// decline
	await db
		.prepare(
			"UPDATE customers SET consentToken = NULL WHERE id = ?",
		)
		.bind(row.id)
		.run();

	await db
		.prepare(
			`INSERT INTO customer_events (id, customerId, userId, type, payload)
			 VALUES (?, ?, ?, 'consent_declined', ?)`,
		)
		.bind(
			crypto.randomUUID(),
			row.id,
			row.userId,
			await encrypt(
				JSON.stringify({ v: 2, ipHash, uaHash }),
				enc,
			),
		)
		.run();

	return c.html(
		page(
			"Declined",
			`<h1>Noted</h1>
			 <p>You won't receive invoices at this email address. The sender has been notified.</p>`,
		),
		200,
		PUBLIC_PAGE_HEADERS,
	);
});

// ─── Revocation routes ────────────────────────────────────────────────────────

type RevokeRow = {
	id: string;
	userId: number;
	name: string;
	email: string;
	revokeToken: string;
};

const lookupRevokeToken = async (
	token: string,
	env: Env,
): Promise<RevokeRow | null> => {
	const db = getDb(env);
	return db
		.prepare(
			`SELECT id, userId, name, email, revokeToken
			 FROM customers WHERE revokeToken = ?`,
		)
		.bind(token)
		.first<RevokeRow>();
};

// GET /consent/revoke/:token — show the revocation confirmation page
app.get("/revoke/:token", async (c) => {
	const token = c.req.param("token");
	const row = await lookupRevokeToken(token, c.env);
	if (!row) {
		return c.html(
			page(
				"Link not found",
				`<h1>This link is no longer valid</h1>
				 <p>The revocation link has already been used or doesn't exist. If you still want to revoke consent, reply to any invoice email.</p>`,
			),
			410,
			PUBLIC_PAGE_HEADERS,
		);
	}

	const dek = await loadUserDek(row.userId, c.env);
	const enc = dek ?? c.env;
	const customerEmail = await decrypt(row.email, enc);
	const csrf = issueCsrfToken(c, "revoke");

	return c.html(
		page(
			"Revoke invoice email consent",
			`<h1>Revoke consent to receive invoices by email</h1>
			 <p>You are about to revoke your consent to receive invoices at <strong>${escape(customerEmail)}</strong>.</p>
			 <p>After revoking, you will no longer receive invoice emails at this address.</p>
			 <form method="POST" action="/consent/revoke/${escape(token)}">
			   ${csrfFormField(csrf)}
			   <button class="agree" type="submit">Yes, revoke my consent</button>
			 </form>
			 <p class="muted">If you didn't intend to do this, you can safely close this page.</p>`,
		),
		200,
		PUBLIC_PAGE_HEADERS,
	);
});

// POST /consent/revoke/:token — execute the revocation
app.post("/revoke/:token", async (c) => {
	const token = c.req.param("token");
	const row = await lookupRevokeToken(token, c.env);
	if (!row) {
		return c.html(
			page(
				"Link not found",
				`<h1>This link is no longer valid</h1>
				 <p>The revocation link has already been used or doesn't exist.</p>`,
			),
			410,
			PUBLIC_PAGE_HEADERS,
		);
	}

	const form = await c.req.parseBody();
	if (!validateCsrfToken(c, "revoke", form[CSRF_FIELD])) {
		return c.html(
			page(
				"Session expired",
				`<h1>Session expired</h1>
				 <p>This revocation page is no longer valid. Please open the revoke link again from your email.</p>`,
			),
			403,
			PUBLIC_PAGE_HEADERS,
		);
	}

	const dek = await loadUserDek(row.userId, c.env);
	const enc = dek ?? c.env;
	const db = getDb(c.env);
	const ip =
		c.req.header("CF-Connecting-IP") ||
		c.req.header("X-Forwarded-For") ||
		"";
	const ua = c.req.header("User-Agent") ?? "";
	const ipHash = ip ? await hmacSha256Hex(ip, c.env) : null;
	const uaHash = ua ? await hmacSha256Hex(ua, c.env) : null;
	const now = new Date().toISOString();

	await db
		.prepare(
			`UPDATE customers
			 SET consentToEmailInvoices = 0, consentedAt = NULL,
			     revokeToken = NULL, consentIpHash = ?, consentUaHash = ?
			 WHERE id = ?`,
		)
		.bind(ipHash, uaHash, row.id)
		.run();

	await db
		.prepare(
			`INSERT INTO customer_events (id, customerId, userId, type, payload)
			 VALUES (?, ?, ?, 'consent_revoked', ?)`,
		)
		.bind(
			crypto.randomUUID(),
			row.id,
			row.userId,
			await encrypt(
				JSON.stringify({ v: 2, ipHash, uaHash, at: now }),
				enc,
			),
		)
		.run();

	return c.html(
		page(
			"Consent revoked",
			`<h1>Consent revoked</h1>
			 <p>Your consent has been removed. You will no longer receive invoice emails at this address.</p>`,
		),
		200,
		PUBLIC_PAGE_HEADERS,
	);
});

export { app as consentRoutes };
