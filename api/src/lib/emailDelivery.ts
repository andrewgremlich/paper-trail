import { decrypt } from "./crypto";
import type { Env } from "./types";

/**
 * Resolves which Resend account + sender to use for a given user.
 *
 * - BYO: user has both `resendApiKey` and `resendFromAddress` configured —
 *   use them. Emails are sent through the user's own Resend account and
 *   the rich invoice template (with line items) is included in the body.
 * - Shared fallback: user has neither (or only one of) the BYO fields —
 *   use the shared env-based config. Callers must use the minimal email
 *   template so invoice details don't land in the operator's Resend
 *   dashboard.
 */

export type EmailDelivery = {
	apiKey: string;
	fromAddress: string;
	usingByo: boolean;
};

export type UserResendConfigRow = {
	resendApiKey: string | null;
	resendFromAddress: string | null;
};

export const resolveEmailDelivery = async (
	row: UserResendConfigRow,
	env: Env,
): Promise<EmailDelivery | { error: "shared_not_configured" }> => {
	if (row.resendApiKey && row.resendFromAddress) {
		return {
			apiKey: await decrypt(row.resendApiKey, env),
			fromAddress: await decrypt(row.resendFromAddress, env),
			usingByo: true,
		};
	}
	if (!env.RESEND_API_KEY || !env.RESEND_FROM_ADDRESS) {
		return { error: "shared_not_configured" };
	}
	return {
		apiKey: env.RESEND_API_KEY,
		fromAddress: env.RESEND_FROM_ADDRESS,
		usingByo: false,
	};
};

const escapeText = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

/**
 * Minimal invoice email body for the shared-Resend fallback. Contains no
 * invoice number, amount, line items, or customer-specific notes — only a
 * greeting, the hosted invoice link, and the consent revoke link. All
 * sensitive detail stays behind the hosted page, which requires the
 * per-invoice access token in the URL.
 */
export const renderMinimalInvoiceHtml = (input: {
	businessName: string;
	customerName: string;
	hostedUrl: string;
	revokeUrl: string;
}): string => {
	const { businessName, customerName, hostedUrl, revokeUrl } = input;
	return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">
<p>Hi ${escapeText(customerName)},</p>
<p>${escapeText(businessName)} has sent you an invoice.</p>
<p style="margin:32px 0">
  <a href="${escapeText(hostedUrl)}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">View invoice</a>
</p>
<p style="color:#666;font-size:13px">If you no longer wish to receive invoices by email from ${escapeText(businessName)}, you can <a href="${escapeText(revokeUrl)}" style="color:#666">unsubscribe</a>.</p>
</body></html>`;
};
