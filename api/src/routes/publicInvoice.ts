import type { Context } from "hono";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { decrypt, encrypt, loadUserDek, loadUserHmacKey } from "../lib/crypto";
import { getDb } from "../lib/db";
import { constantTimeEqual, hmacSha256Hex } from "../lib/hash";
import { renderInvoiceHtml, type RenderOptions } from "../lib/invoiceHtml";
import type { Env, InvoiceSnapshot } from "../lib/types";

/**
 * Public hosted invoice page. Mounted on the top-level `app`, not under
 * /api/v1, so it bypasses the Clerk auth middleware — the customer
 * is not authenticated.
 *
 * Only sent invoices (with a frozen `snapshot`) are served from here.
 * Drafts 404 — preview them through the authed `/api/v1/invoices/:id/preview`.
 *
 * Access control: a per-invoice access token (rotated on every send,
 * stored at `invoices.accessToken`, bounded by `accessTokenExpiresAt`).
 * On first hit the token is presented as `?t=<token>` in the URL. The
 * route validates it, stores it in a HttpOnly cookie scoped to
 * `/invoice/<id>`, and 302s to the token-less URL — that keeps the
 * token out of browser history, proxy logs, and any URL the customer
 * later screenshots or forwards (INV2). Subsequent requests in the
 * same browser authenticate via the cookie.
 *
 * View events are not logged on this route. A 1x1 image beacon
 * (`/invoice/<id>/seen`) injected into the rendered HTML logs them
 * instead, so email prefetchers and corporate URL scanners (which only
 * fetch the primary URL, not sub-resources) don't poison the "your
 * customer opened the invoice" signal (INV4).
 */

const app = new Hono<{ Bindings: Env }>();

// Mirror of the encryption-key guard in clerkAuth. The public routes
// decrypt() snapshot + customer rows; without a key, a misdeployed
// Worker would serve plaintext rows as if they were encrypted.
app.use("/*", async (c, next) => {
	if (c.env.CLERK_BYPASS !== "true" && !c.env.ENCRYPTION_KEY) {
		console.error("ENCRYPTION_KEY missing in production deploy");
		return c.json({ error: "Server is misconfigured" }, 500);
	}
	return next();
});

// Headers applied to every public hosted page. `no-referrer` keeps the
// hosted URL out of Venmo / PayPal Referer logs; the CSP locks the
// renderer's surface down to the inline styles it actually needs.
const PUBLIC_PAGE_HEADERS = {
	"Cache-Control": "no-store",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
} as const;

const cookieName = (invoiceId: string): string => `pt_inv_${invoiceId}`;
const cookiePath = (invoiceId: string): string => `/invoice/${invoiceId}`;

type InvoiceRow = {
	id: string;
	userId: number;
	customerId: string;
	timesheetId: string | null;
	number: string;
	status: string;
	amount_cents: string;
	description: string | null;
	issuedAt: string;
	dueDate: string;
	snapshot: string | null;
	accessToken: string | null;
	accessTokenExpiresAt: string | null;
};

const loadInvoice = (env: Env, id: string) =>
	getDb(env)
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, snapshot,
			        accessToken, accessTokenExpiresAt
			 FROM invoices WHERE id = ? AND archivedAt IS NULL`,
		)
		.bind(id)
		.first<InvoiceRow>();

// 1x1 transparent GIF — used as the view-beacon response.
const TRANSPARENT_GIF = Uint8Array.from([
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
	0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
	0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
	0x44, 0x01, 0x00, 0x3b,
]);

const respondWithBeacon = (c: Context<{ Bindings: Env }>) =>
	c.body(TRANSPARENT_GIF, 200, {
		"Content-Type": "image/gif",
		"Cache-Control": "no-store",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
	});

app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const row = await loadInvoice(c.env, id);

	const notFound = c.html(
		"<!DOCTYPE html><html><body><h1>Invoice not found</h1></body></html>",
		404,
		PUBLIC_PAGE_HEADERS,
	);

	if (!row || !row.snapshot || !row.accessToken) {
		return notFound;
	}

	// Only finalized statuses are publicly hostable. A 'draft' has no
	// snapshot/token so it's already excluded above, but guard explicitly
	// so a future state with a stale token can't leak a draft. 'void' and
	// 'paid' still render — with a status banner and no pay buttons — so a
	// forwarded link reflects current state instead of 404ing silently.
	if (
		row.status !== "published" &&
		row.status !== "sent" &&
		row.status !== "paid" &&
		row.status !== "void"
	) {
		return notFound;
	}

	// Stale tokens are treated as missing — past the expiry, the operator
	// must resend to mint a new token + window.
	if (
		row.accessTokenExpiresAt &&
		new Date(row.accessTokenExpiresAt).getTime() <= Date.now()
	) {
		return notFound;
	}

	// Token resolution: prefer the query string (allows token rotation
	// after a resend to "just work" — the new emailed link overwrites the
	// stale cookie). Fall back to the cookie when the URL has been
	// stripped of `?t=` by the 302 below.
	const queryToken = c.req.query("t");
	const cookieToken = getCookie(c, cookieName(id));
	const providedToken = queryToken ?? cookieToken ?? null;

	if (!providedToken || !constantTimeEqual(providedToken, row.accessToken)) {
		return notFound;
	}

	// First hit via `?t=` — store the token in a path-scoped HttpOnly
	// cookie and 302 to the bare URL. The redirect strips the token from
	// the address bar, browser history, and any subsequent Referer
	// header.
	if (queryToken) {
		const ttlSeconds = row.accessTokenExpiresAt
			? Math.max(
					0,
					Math.floor(
						(new Date(row.accessTokenExpiresAt).getTime() - Date.now()) / 1000,
					),
				)
			: 90 * 24 * 60 * 60;
		setCookie(c, cookieName(id), queryToken, {
			path: cookiePath(id),
			httpOnly: true,
			sameSite: "Lax",
			secure: true,
			maxAge: ttlSeconds,
		});
		return c.redirect(cookiePath(id), 302);
	}

	const dek = await loadUserDek(row.userId, c.env);
	if (!dek) {
		return notFound;
	}

	let snapshot: InvoiceSnapshot | null = null;
	try {
		snapshot = JSON.parse(await decrypt(row.snapshot, dek));
	} catch {
		snapshot = null;
	}
	if (!snapshot) {
		return notFound;
	}

	const html = renderInvoiceHtml(snapshot, {
		seenBeaconUrl: `/invoice/${id}/seen`,
		status: row.status as RenderOptions["status"],
	});
	return c.html(html, 200, PUBLIC_PAGE_HEADERS);
});

// View beacon (INV4). Fired by the `<img>` injected into the rendered
// hosted page; logs a `viewed` event with hashed IP+UA. Email
// prefetchers fetch the primary URL only, so any hit here reflects a
// real browser render rather than a Gmail/Outlook/scanner probe.
//
// Auth is via the same path-scoped cookie set by GET /:id — a beacon
// hit with no cookie or a stale cookie returns the same transparent
// GIF without writing anything, so the endpoint doesn't double as a
// "does this invoice exist" oracle.
app.get("/:id/seen", async (c) => {
	const id = c.req.param("id");
	const cookieToken = getCookie(c, cookieName(id));
	if (!cookieToken) {
		return respondWithBeacon(c);
	}

	const row = await loadInvoice(c.env, id);
	if (!row || !row.accessToken || !row.snapshot) {
		return respondWithBeacon(c);
	}
	if (
		row.accessTokenExpiresAt &&
		new Date(row.accessTokenExpiresAt).getTime() <= Date.now()
	) {
		return respondWithBeacon(c);
	}
	if (!constantTimeEqual(cookieToken, row.accessToken)) {
		return respondWithBeacon(c);
	}

	if (
		row.status !== "published" &&
		row.status !== "sent" &&
		row.status !== "paid"
	) {
		return respondWithBeacon(c);
	}

	const dek = await loadUserDek(row.userId, c.env);
	const hmacKey = await loadUserHmacKey(row.userId, c.env);
	if (!dek || !hmacKey) {
		// Owner has no DEK — skip the audit write rather than 500ing a
		// transparent-GIF response. The beacon stays silent and a
		// subsequent migration run will rectify the missing DEK.
		return respondWithBeacon(c);
	}
	const db = getDb(c.env);
	const ip =
		c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
	const ua = c.req.header("User-Agent") ?? "";
	const ipHash = ip ? await hmacSha256Hex(ip, hmacKey) : null;
	const uaHash = ua ? await hmacSha256Hex(ua, hmacKey) : null;
	await db
		.prepare(
			`INSERT INTO invoice_events (id, invoiceId, userId, type, payload)
			 VALUES (?, ?, ?, 'viewed', ?)`,
		)
		.bind(
			crypto.randomUUID(),
			row.id,
			row.userId,
			await encrypt(JSON.stringify({ v: 2, ipHash, uaHash }), dek),
		)
		.run();

	return respondWithBeacon(c);
});

export { app as publicInvoiceRoutes };
