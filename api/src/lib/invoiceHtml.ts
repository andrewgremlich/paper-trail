import type { InvoiceSnapshot } from "./types";

/**
 * Renders the invoice as a self-contained HTML document.
 *
 * Used for both the email body (Resend) and the public hosted page
 * (`GET /invoice/:uuid`). Always renders from a frozen `InvoiceSnapshot`,
 * never live joins, so a sent invoice is tamper-evident.
 *
 * All interpolated user strings are HTML-escaped to prevent stored XSS
 * via description fields, customer names, etc.
 */

const escapeHtml = (value: string | null | undefined): string => {
	if (value == null) return "";
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
};

const formatCents = (cents: number): string => {
	const dollars = cents / 100;
	return dollars.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
};

const formatMinutes = (minutes: number | null | undefined): string => {
	if (minutes == null) return "";
	const hours = minutes / 60;
	return `${hours.toFixed(2)} h`;
};

const venmoLink = (
	handle: string,
	amountCents: number,
	note: string,
): string => {
	const dollars = (amountCents / 100).toFixed(2);
	const params = new URLSearchParams({
		txn: "charge",
		amount: dollars,
		note,
	});
	return `https://venmo.com/u/${encodeURIComponent(handle)}?${params.toString()}`;
};

const paypalLink = (handle: string, amountCents: number): string => {
	const dollars = (amountCents / 100).toFixed(2);
	return `https://paypal.me/${encodeURIComponent(handle)}/${dollars}USD`;
};

const nl2br = (value: string): string =>
	escapeHtml(value).replace(/\n/g, "<br />");

export type RenderOptions = {
	/** Absolute URL of the hosted invoice page, used by the email "View invoice" link. */
	hostedUrl?: string;
	/** Show a banner indicating this is a draft preview (used on the hosted page only). */
	isDraftPreview?: boolean;
	/** Show the Print button on the hosted page. */
	includePrintButton?: boolean;
};

export const renderInvoiceHtml = (
	snapshot: InvoiceSnapshot,
	options: RenderOptions = {},
): string => {
	const { seller, buyer, invoice, lineItems } = snapshot;

	const lineItemsHtml = lineItems
		.map(
			(item) => `
        <tr>
          <td>${escapeHtml(item.date ?? "")}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${escapeHtml(formatMinutes(item.minutes))}</td>
          <td class="num">${escapeHtml(formatCents(item.amountCents))}</td>
        </tr>`,
		)
		.join("");

	const paymentOptions: string[] = [];
	if (seller.venmoHandle) {
		paymentOptions.push(`
      <a class="pay-btn pay-venmo" href="${escapeHtml(venmoLink(seller.venmoHandle, invoice.amountCents, invoice.number))}">
        Pay ${escapeHtml(formatCents(invoice.amountCents))} with Venmo
      </a>`);
	}
	if (seller.paypalHandle) {
		paymentOptions.push(`
      <a class="pay-btn pay-paypal" href="${escapeHtml(paypalLink(seller.paypalHandle, invoice.amountCents))}">
        Pay ${escapeHtml(formatCents(invoice.amountCents))} with PayPal
      </a>`);
	}

	const checkBlock = `
    <div class="pay-check">
      <div class="pay-check-label">Or mail a check to:</div>
      <div class="pay-check-addr">
        ${escapeHtml(seller.businessName)}<br />
        ${nl2br(seller.businessAddress)}
      </div>
    </div>`;

	const draftBanner = options.isDraftPreview
		? `<div class="draft-banner">DRAFT PREVIEW — this invoice has not been sent.</div>`
		: "";

	const hostedLink = options.hostedUrl
		? `<p class="hosted-link"><a href="${escapeHtml(options.hostedUrl)}">View this invoice online</a></p>`
		: "";

	const printButton = options.includePrintButton
		? `<button type="button" class="print-btn" onclick="window.print()">Print / Save as PDF</button>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>Invoice ${escapeHtml(invoice.number)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    background: #f5f5f5;
    margin: 0;
    padding: 24px 12px;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    padding: 40px 48px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .draft-banner {
    background: #fff5d6;
    color: #5a4500;
    padding: 12px 16px;
    border-radius: 4px;
    margin-bottom: 24px;
    font-weight: 600;
    text-align: center;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .header h1 { margin: 0; font-size: 28px; letter-spacing: 0.05em; }
  .header .meta { text-align: right; font-size: 14px; line-height: 1.5; }
  .header .meta .label { color: #666; }
  .parties { display: flex; gap: 48px; margin-bottom: 32px; font-size: 14px; line-height: 1.5; }
  .party { flex: 1; }
  .party .label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .party .name { font-weight: 600; margin-bottom: 4px; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }
  table.lines th, table.lines td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e5e5e5; }
  table.lines th { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  table.lines td.num, table.lines th.num { text-align: right; white-space: nowrap; }
  .totals { text-align: right; font-size: 16px; margin-bottom: 32px; }
  .totals .total-row { font-weight: 600; font-size: 18px; }
  .pay-section { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 24px; margin-bottom: 24px; }
  .pay-section h2 { margin: 0 0 16px; font-size: 16px; }
  .pay-btn {
    display: inline-block;
    padding: 12px 20px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    margin: 0 8px 8px 0;
    color: #fff;
  }
  .pay-venmo { background: #3d95ce; }
  .pay-paypal { background: #003087; }
  .pay-check { margin-top: 16px; font-size: 14px; }
  .pay-check-label { color: #666; margin-bottom: 6px; }
  .pay-check-addr { line-height: 1.5; }
  .print-btn {
    background: #1a1a1a;
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin-bottom: 16px;
  }
  .hosted-link { font-size: 14px; color: #666; }
  .desc { margin-bottom: 24px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; padding: 0; max-width: none; }
    .print-btn, .pay-btn, .draft-banner, .hosted-link { display: none !important; }
    .pay-section { background: #fff; }
  }
</style>
</head>
<body>
  <div class="sheet">
    ${draftBanner}
    ${printButton}
    <div class="header">
      <div>
        <h1>INVOICE</h1>
      </div>
      <div class="meta">
        <div><span class="label">Number:</span> ${escapeHtml(invoice.number)}</div>
        <div><span class="label">Issued:</span> ${escapeHtml(invoice.issuedAt)}</div>
        <div><span class="label">Due:</span> ${escapeHtml(invoice.dueDate)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="label">From</div>
        <div class="name">${escapeHtml(seller.businessName)}</div>
        <div>${nl2br(seller.businessAddress)}</div>
        <div>${escapeHtml(seller.email)}</div>
      </div>
      <div class="party">
        <div class="label">To</div>
        <div class="name">${escapeHtml(buyer.name)}</div>
        ${buyer.address ? `<div>${nl2br(buyer.address)}</div>` : ""}
        <div>${escapeHtml(buyer.email)}</div>
      </div>
    </div>

    ${invoice.description ? `<div class="desc">${nl2br(invoice.description)}</div>` : ""}

    ${
		lineItems.length > 0
			? `<table class="lines">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th class="num">Hours</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>${lineItemsHtml}</tbody>
          </table>`
			: ""
	}

    <div class="totals">
      <div class="total-row">Total: ${escapeHtml(formatCents(invoice.amountCents))}</div>
    </div>

    <div class="pay-section">
      <h2>Payment options</h2>
      ${paymentOptions.length > 0 ? paymentOptions.join("") : "<p>Contact the sender for payment instructions.</p>"}
      ${checkBlock}
    </div>

    ${hostedLink}
  </div>
</body>
</html>`;
};

// Exported for unit tests
export { escapeHtml };
