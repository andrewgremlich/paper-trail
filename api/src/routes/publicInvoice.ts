import { Hono } from "hono";
import { decrypt, encrypt, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import { constantTimeEqual, sha256Hex } from "../lib/hash";
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

	// Sent invoices require the per-invoice access token. Drafts are
	// tokenless (only viewed from the authenticated app). Comparison is
	// constant-time so this route does not leak whether the prefix
	// matched via response timing.
	if (row.snapshot) {
		const providedToken = c.req.query("t");
		const expected = row.accessToken;
		if (
			!expected ||
			!providedToken ||
			!constantTimeEqual(providedToken, expected)
		) {
			return notFound;
		}
	}

	let snapshot: InvoiceSnapshot | null = null;
	if (row.snapshot) {
		try {
			snapshot = JSON.parse(await decrypt(row.snapshot, c.env));
		} catch {
			snapshot = null;
		}
	}

	const isDraftPreview = !snapshot;

	if (!snapshot) {
		// Draft preview — rebuild from live state.
		const user = await db
			.prepare(
				`SELECT email, venmoHandle, paypalHandle, businessName, businessAddress
				 FROM users WHERE id = ?`,
			)
			.bind(row.userId)
			.first<{
				email: string;
				venmoHandle: string | null;
				paypalHandle: string | null;
				businessName: string | null;
				businessAddress: string | null;
			}>();
		const customer = await db
			.prepare("SELECT name, email, address FROM customers WHERE id = ?")
			.bind(row.customerId)
			.first<{ name: string; email: string; address: string | null }>();
		if (!user || !customer) {
			return c.html(
				"<!DOCTYPE html><html><body><h1>Invoice not available</h1></body></html>",
				404,
				PUBLIC_PAGE_HEADERS,
			);
		}

		const lineItems: InvoiceSnapshot["lineItems"] = [];
		if (row.timesheetId) {
			const ts = await db
				.prepare(
					`SELECT p.rate_in_cents AS projectRate
					 FROM timesheets t JOIN projects p ON p.id = t.projectId
					 WHERE t.id = ?`,
				)
				.bind(row.timesheetId)
				.first<{ projectRate: string | number | null }>();
			const rate = ts
				? isEncryptionEnabled(c.env)
					? Number(await decrypt(String(ts.projectRate), c.env))
					: Number(ts.projectRate ?? 0)
				: 0;
			const { results: entries } = await db
				.prepare(
					`SELECT date, minutes, description FROM timesheet_entries
					 WHERE timesheetId = ? ORDER BY date ASC`,
				)
				.bind(row.timesheetId)
				.all<{ date: string; minutes: number; description: string }>();
			for (const e of entries) {
				lineItems.push({
					date: e.date,
					description: await decrypt(e.description, c.env),
					minutes: e.minutes,
					amountCents: rate ? Math.round((e.minutes * rate) / 60) : 0,
				});
			}
		}

		const amountCents = isEncryptionEnabled(c.env)
			? Number(await decrypt(row.amount_cents, c.env))
			: Number(row.amount_cents);

		snapshot = {
			seller: {
				businessName: user.businessName
					? await decrypt(user.businessName, c.env)
					: "",
				businessAddress: user.businessAddress
					? await decrypt(user.businessAddress, c.env)
					: "",
				email: user.email,
				venmoHandle: user.venmoHandle
					? await decrypt(user.venmoHandle, c.env)
					: null,
				paypalHandle: user.paypalHandle
					? await decrypt(user.paypalHandle, c.env)
					: null,
			},
			buyer: {
				name: await decrypt(customer.name, c.env),
				email: await decrypt(customer.email, c.env),
				address: customer.address
					? await decrypt(customer.address, c.env)
					: null,
			},
			invoice: {
				number: row.number,
				id,
				issuedAt: row.issuedAt,
				dueDate: row.dueDate,
				description: row.description
					? await decrypt(row.description, c.env)
					: null,
				amountCents,
			},
			lineItems,
		};
	}

	// Log a 'viewed' event with hashed IP+UA (only for sent invoices to avoid noise from drafts).
	if (row.status === "sent" || row.status === "paid") {
		const ip =
			c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
		const ua = c.req.header("User-Agent") ?? "";
		const ipHash = ip ? await sha256Hex(ip, c.env) : null;
		const uaHash = ua ? await sha256Hex(ua, c.env) : null;
		await db
			.prepare(
				`INSERT INTO invoice_events (id, invoiceId, userId, type, payload)
				 VALUES (?, ?, ?, 'viewed', ?)`,
			)
			.bind(
				crypto.randomUUID(),
				row.id,
				row.userId,
				await encrypt(JSON.stringify({ ipHash, uaHash }), c.env),
			)
			.run();
	}

	const html = renderInvoiceHtml(snapshot, {
		isDraftPreview,
		includePrintButton: true,
	});
	return c.html(html, 200, PUBLIC_PAGE_HEADERS);
});

export { app as publicInvoiceRoutes };
