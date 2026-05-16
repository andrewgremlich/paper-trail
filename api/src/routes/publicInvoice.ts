import { Hono } from "hono";
import { decrypt, encrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import { constantTimeEqual, hmacSha256Hex } from "../lib/hash";
import { renderInvoiceHtml } from "../lib/invoiceHtml";
import type { Env, InvoiceSnapshot } from "../lib/types";

/**
 * Public hosted invoice page. Mounted on the top-level `app`, not under
 * /api/v1, so it bypasses the Cloudflare Access middleware — the customer
 * is not authenticated.
 *
 * Renders the immutable snapshot if the invoice has been sent; otherwise
 * shows a draft preview built from current data with a warning banner.
 *
 * Sent invoices require a per-invoice access token in the query string
 * (`?t=<token>`) that matches `invoices.accessToken`. The token is
 * generated and rotated by the send handler in routes/invoices.ts, so
 * old emailed links stop working after a resend. Without the token, the
 * route returns 404 — never disclosing whether the invoice exists.
 *
 * Drafts (no snapshot yet) are tokenless because they are only ever
 * opened from the authenticated app via "Preview".
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

// Headers applied to every public hosted page. `no-referrer` is the
// critical one — the URL carries the per-invoice access token as
// `?t=<token>`, and the hosted page links out to Venmo / PayPal. Without
// this, those third parties (and any intermediate proxy) would receive
// the token in the Referer header.
const PUBLIC_PAGE_HEADERS = {
	"Cache-Control": "no-store",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	// CSP for the hosted invoice page. The renderer has no inline scripts
	// (the print button was removed), so we can lock script execution down
	// entirely. Inline styles in the renderer are unavoidable, so
	// `style-src 'unsafe-inline'` is the price.
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
} as const;

app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);

	const row = await db
		.prepare(
			`SELECT id, userId, customerId, timesheetId, number, status,
			        amount_cents, description, issuedAt, dueDate, snapshot,
			        accessToken
			 FROM invoices WHERE id = ? AND archivedAt IS NULL`,
		)
		.bind(id)
		.first<{
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
		}>();

	const notFound = c.html(
		"<!DOCTYPE html><html><body><h1>Invoice not found</h1></body></html>",
		404,
		PUBLIC_PAGE_HEADERS,
	);

	if (!row) {
		return notFound;
	}

	// Drafts are not served from the public route. Previewing an unsent
	// invoice is an authenticated action — see
	// /api/v1/invoices/:id/preview. The public route only serves sent
	// invoices, gated by the per-invoice access token.
	if (!row.snapshot) {
		return notFound;
	}
	const providedToken = c.req.query("t");
	const expected = row.accessToken;
	if (
		!expected ||
		!providedToken ||
		!constantTimeEqual(providedToken, expected)
	) {
		return notFound;
	}

	let snapshot: InvoiceSnapshot | null = null;
	try {
		snapshot = JSON.parse(await decrypt(row.snapshot, c.env));
	} catch {
		snapshot = null;
	}
	if (!snapshot) {
		return notFound;
	}

	// Log a 'viewed' event with hashed IP+UA.
	if (row.status === "sent" || row.status === "paid") {
		const ip =
			c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
		const ua = c.req.header("User-Agent") ?? "";
		const ipHash = ip ? await hmacSha256Hex(ip, c.env) : null;
		const uaHash = ua ? await hmacSha256Hex(ua, c.env) : null;
		await db
			.prepare(
				`INSERT INTO invoice_events (id, invoiceId, userId, type, payload)
				 VALUES (?, ?, ?, 'viewed', ?)`,
			)
			.bind(
				crypto.randomUUID(),
				row.id,
				row.userId,
				await encrypt(JSON.stringify({ v: 2, ipHash, uaHash }), c.env),
			)
			.run();
	}

	const html = renderInvoiceHtml(snapshot);
	return c.html(html, 200, PUBLIC_PAGE_HEADERS);
});

export { app as publicInvoiceRoutes };
