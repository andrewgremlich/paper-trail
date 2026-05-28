import { Hono } from "hono";
import { z } from "zod";
import { decrypt, type EncryptionContext, encrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import { resolveEmailDelivery } from "../lib/emailDelivery";
import { randomHexToken } from "../lib/hash";
import { assertWithinSendLimit, RateLimitError } from "../lib/rateLimit";
import { ResendError, sendEmail } from "../lib/resend";
import type { Customer, Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

// Refuse to re-send a consent email to the same customer within this
// window if they haven't acted on the previous one. Keeps an honest
// retry possible after a day, but stops a tight loop of unsolicited
// emails to the same recipient.
const CONSENT_REREQUEST_BACKOFF_MS = 24 * 60 * 60 * 1000;

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const contactChannelSchema = z.enum([
	"phone",
	"sms",
	"whatsapp",
	"telegram",
	"signal",
	"discord",
]);

const customerSchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		email: z.string().trim().toLowerCase().email().max(320),
		address: z.string().trim().max(1000).optional().nullable(),
		contactChannel: contactChannelSchema.optional().nullable(),
		contactValue: z.string().trim().max(200).optional().nullable(),
	})
	.refine(
		(data) =>
			// Either both contact fields are set, or both are blank/null. A
			// channel without a value (or vice versa) is meaningless.
			(!!data.contactChannel && !!data.contactValue) ||
			(!data.contactChannel && !data.contactValue),
		{
			message: "contactChannel and contactValue must be set together",
			path: ["contactValue"],
		},
	);

type DbCustomerRow = {
	id: string;
	userId: number;
	name: string;
	email: string;
	address: string | null;
	contactChannel: string | null;
	contactValue: string | null;
	consentToEmailInvoices: number;
	consentedAt: string | null;
	consentRequestedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

const decryptCustomer = async (
	row: DbCustomerRow,
	ctx: EncryptionContext,
): Promise<Customer> => ({
	id: row.id,
	userId: row.userId,
	name: await decrypt(row.name, ctx),
	email: await decrypt(row.email, ctx),
	address: row.address ? await decrypt(row.address, ctx) : null,
	contactChannel: (row.contactChannel as Customer["contactChannel"]) ?? null,
	contactValue: row.contactValue ? await decrypt(row.contactValue, ctx) : null,
	consentToEmailInvoices: !!row.consentToEmailInvoices,
	consentedAt: row.consentedAt,
	consentRequestedAt: row.consentRequestedAt,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

// GET /api/v1/customers - list user's customers
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	const { results } = await db
		.prepare(
			`SELECT id, userId, name, email, address, contactChannel, contactValue,
			        consentToEmailInvoices, consentedAt, consentRequestedAt,
			        createdAt, updatedAt
			 FROM customers WHERE userId = ? ORDER BY createdAt ASC`,
		)
		.bind(userId)
		.all<DbCustomerRow>();

	const decrypted = await Promise.all(
		results.map((row) => decryptCustomer(row, enc)),
	);
	return c.json(decrypted);
});

// GET /api/v1/customers/:id
app.get("/:id", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");
	const id = c.req.param("id");

	const row = await db
		.prepare(
			`SELECT id, userId, name, email, address, contactChannel, contactValue,
			        consentToEmailInvoices, consentedAt, consentRequestedAt,
			        createdAt, updatedAt
			 FROM customers WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first<DbCustomerRow>();

	if (!row) return c.json({ error: "Customer not found" }, 404);
	return c.json(await decryptCustomer(row, enc));
});

// POST /api/v1/customers
app.post("/", async (c) => {
	const parsed = customerSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid customer", issues: parsed.error.issues },
			400,
		);
	}
	const { name, email, address, contactChannel, contactValue } = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");
	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO customers (id, userId, name, email, address, contactChannel, contactValue)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			userId,
			await encrypt(name, enc),
			await encrypt(email, enc),
			address ? await encrypt(address, enc) : null,
			contactChannel ?? null,
			contactValue ? await encrypt(contactValue, enc) : null,
		)
		.run();

	return c.json({ success: true, id }, 201);
});

// PUT /api/v1/customers/:id
app.put("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = customerSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid customer", issues: parsed.error.issues },
			400,
		);
	}
	const { name, email, address, contactChannel, contactValue } = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	await db
		.prepare(
			`UPDATE customers SET name = ?, email = ?, address = ?,
			        contactChannel = ?, contactValue = ?
			 WHERE id = ? AND userId = ?`,
		)
		.bind(
			await encrypt(name, enc),
			await encrypt(email, enc),
			address ? await encrypt(address, enc) : null,
			contactChannel ?? null,
			contactValue ? await encrypt(contactValue, enc) : null,
			id,
			userId,
		)
		.run();

	return c.json({ success: true });
});

// DELETE /api/v1/customers/:id - block if referenced by invoices
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	const invRef = await db
		.prepare(
			"SELECT COUNT(*) AS n FROM invoices WHERE customerId = ? AND userId = ?",
		)
		.bind(id, userId)
		.first<{ n: number }>();

	if ((invRef?.n ?? 0) > 0) {
		return c.json(
			{
				error:
					"Cannot delete customer with linked invoices. Void or archive the invoices first.",
				code: "CUSTOMER_HAS_INVOICES",
			},
			409,
		);
	}

	// Null out any projects pointing at this customer so the user can re-link.
	await db
		.prepare(
			"UPDATE projects SET customerId = NULL WHERE customerId = ? AND userId = ?",
		)
		.bind(id, userId)
		.run();

	await db
		.prepare("DELETE FROM customers WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

// POST /api/v1/customers/:id/request-consent
// Sends a double-opt-in email to the customer asking them to consent to
// receiving invoices electronically. Generates a single-use token; the
// public /consent/:token routes flip the flag when the customer clicks.
app.post("/:id/request-consent", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	const customerRow = await db
		.prepare(
			`SELECT id, userId, name, email, address, contactChannel, contactValue,
			        consentToEmailInvoices, consentedAt, consentRequestedAt,
			        createdAt, updatedAt
			 FROM customers WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.first<DbCustomerRow>();
	if (!customerRow) return c.json({ error: "Customer not found" }, 404);

	// 24h back-off: if a consent request was already sent and the customer
	// hasn't acted on it, don't pelt them with another one.
	if (!customerRow.consentToEmailInvoices && customerRow.consentRequestedAt) {
		const requestedMs = Date.parse(customerRow.consentRequestedAt);
		if (
			Number.isFinite(requestedMs) &&
			Date.now() - requestedMs < CONSENT_REREQUEST_BACKOFF_MS
		) {
			const retryAfterSeconds = Math.ceil(
				(requestedMs + CONSENT_REREQUEST_BACKOFF_MS - Date.now()) / 1000,
			);
			return c.json(
				{
					error:
						"A consent request was already sent recently. Wait 24 hours before resending.",
					code: "CONSENT_REREQUEST_TOO_SOON",
					retryAfterSeconds,
				},
				429,
				{ "Retry-After": String(retryAfterSeconds) },
			);
		}
	}

	const userRow = await db
		.prepare(
			`SELECT email, businessName, resendApiKey, resendFromAddress
			 FROM users WHERE id = ?`,
		)
		.bind(userId)
		.first<{
			email: string;
			businessName: string | null;
			resendApiKey: string | null;
			resendFromAddress: string | null;
		}>();
	if (!userRow) return c.json({ error: "User not found" }, 500);

	const businessName = userRow.businessName
		? await decrypt(userRow.businessName, enc)
		: null;
	if (!businessName) {
		return c.json(
			{
				error: "Set your business name in Settings before requesting consent.",
				code: "BUSINESS_NAME_MISSING",
			},
			412,
		);
	}

	if (!c.env.APP_BASE_URL) {
		return c.json(
			{
				error: "Email is not configured (APP_BASE_URL).",
				code: "EMAIL_NOT_CONFIGURED",
			},
			500,
		);
	}
	const delivery = await resolveEmailDelivery(userRow, c.env, enc);
	if ("error" in delivery) {
		return c.json(
			{
				error:
					"Email is not configured. Set RESEND_API_KEY and RESEND_FROM_ADDRESS, or configure your own Resend account in Settings.",
				code: "EMAIL_NOT_CONFIGURED",
			},
			500,
		);
	}

	// Decrypted before the rate-limit check so the per-recipient
	// throttle has the address to hash.
	const customerName = await decrypt(customerRow.name, enc);
	const customerEmail = await decrypt(customerRow.email, enc);

	// Share the invoice-send rate limit budget: spam-protects the operator
	// and keeps a single user from being used as an email cannon. Passing
	// the recipient address adds a per-recipient daily cap to protect the
	// shared sending-domain reputation.
	try {
		await assertWithinSendLimit(userId, c.env, customerEmail);
	} catch (err) {
		if (err instanceof RateLimitError) {
			return c.json(
				{
					error: "Send rate limit exceeded. Try again later.",
					code: "RATE_LIMITED",
					retryAfterSeconds: err.retryAfterSeconds,
				},
				429,
				{ "Retry-After": String(err.retryAfterSeconds) },
			);
		}
		throw err;
	}

	const token = randomHexToken(32);
	const now = new Date().toISOString();

	await db
		.prepare(
			`UPDATE customers
			 SET consentToken = ?, consentRequestedAt = ?,
			     consentIpHash = NULL, consentUaHash = NULL
			 WHERE id = ? AND userId = ?`,
		)
		.bind(token, now, id, userId)
		.run();

	const consentUrl = `${c.env.APP_BASE_URL.replace(/\/$/, "")}/consent/${token}`;

	const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeText(customerName)},</p>
<p><strong>${escapeText(businessName)}</strong> would like your permission to send you invoices by email.</p>
<p>If you agree, you'll receive HTML invoices at this email address (${escapeText(customerEmail)}) with payment links. You can revoke consent at any time using the unsubscribe link included in every invoice.</p>
<p style="margin:32px 0">
  <a href="${escapeText(consentUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Review consent request</a>
</p>
<p style="color:#666;font-size:13px">If you weren't expecting this, you can ignore it — no email will be sent without your explicit consent.</p>
</body></html>`;

	try {
		await sendEmail({
			from: delivery.fromAddress,
			to: customerEmail,
			subject: `${businessName} would like to send you invoices by email`,
			html,
			replyTo: userRow.email,
			apiKey: delivery.apiKey,
		});
	} catch (err) {
		// Roll the token back so the user can retry once they fix the config.
		await db
			.prepare(
				"UPDATE customers SET consentToken = NULL, consentRequestedAt = NULL WHERE id = ?",
			)
			.bind(id)
			.run();
		if (err instanceof ResendError && err.code === "domain_not_verified") {
			return c.json(
				{
					error:
						"Sending domain is not verified in Resend. See docs/EMAIL_SETUP.md.",
					code: "DOMAIN_NOT_VERIFIED",
				},
				412,
			);
		}
		console.error("Consent email failed", { customerId: id });
		return c.json({ error: "Failed to send consent email" }, 502);
	}

	await db
		.prepare(
			`INSERT INTO customer_events (id, customerId, userId, type, payload)
			 VALUES (?, ?, ?, 'consent_requested', ?)`,
		)
		.bind(
			crypto.randomUUID(),
			id,
			userId,
			// No payload fields — the bare 'consent_requested' row is the audit signal.
			// We intentionally do not store any token bytes here (§13).
			await encrypt(JSON.stringify({}), enc),
		)
		.run();

	return c.json({ success: true });
});

// POST /api/v1/customers/:id/revoke-consent
// Authenticated route — lets the seller revoke consent on behalf of a customer.
app.post("/:id/revoke-consent", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	const row = await db
		.prepare("SELECT id, userId FROM customers WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.first<{ id: string; userId: number }>();
	if (!row) return c.json({ error: "Customer not found" }, 404);

	const now = new Date().toISOString();

	await db
		.prepare(
			`UPDATE customers
			 SET consentToEmailInvoices = 0, consentedAt = NULL,
			     revokeToken = NULL
			 WHERE id = ? AND userId = ?`,
		)
		.bind(id, userId)
		.run();

	await db
		.prepare(
			`INSERT INTO customer_events (id, customerId, userId, type, payload)
			 VALUES (?, ?, ?, 'consent_revoked', ?)`,
		)
		.bind(
			crypto.randomUUID(),
			id,
			userId,
			await encrypt(JSON.stringify({ revokedBy: "seller", at: now }), enc),
		)
		.run();

	return c.json({ success: true });
});

// Minimal HTML escape for the consent-request email (avoid circular import with invoiceHtml)
function escapeText(value: string): string {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export { app as customerRoutes };
