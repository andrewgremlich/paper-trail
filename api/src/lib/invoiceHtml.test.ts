import { describe, expect, it } from "vitest";
import { escapeHtml, renderInvoiceHtml } from "./invoiceHtml";
import type { InvoiceSnapshot } from "./types";

const baseSnapshot = (): InvoiceSnapshot => ({
	seller: {
		businessName: "Acme LLC",
		businessAddress: "123 Main St\nSpringfield",
		email: "seller@example.com",
		venmoHandle: "acme-llc",
		paypalHandle: "acmellc",
	},
	buyer: {
		name: "Customer Co",
		email: "buyer@example.com",
		address: "456 Oak Ave",
	},
	invoice: {
		number: "INV-001",
		id: "inv-id-1",
		issuedAt: "2026-05-01",
		dueDate: "2026-05-31",
		description: "Consulting work",
		amountCents: 50000,
	},
	lineItems: [
		{ date: "2026-05-01", description: "Design", minutes: 60, amountCents: 10000 },
		{ date: "2026-05-02", description: "Build", minutes: 240, amountCents: 40000 },
	],
});

describe("escapeHtml", () => {
	it("escapes the five canonical HTML entities", () => {
		expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
			"&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
		);
	});

	it("escapes & first so already-escaped entities don't double-escape oddly", () => {
		// "&" → "&amp;" first, then "<" → "&lt;" — net effect: "&<" → "&amp;&lt;"
		expect(escapeHtml("&<")).toBe("&amp;&lt;");
	});

	it("returns '' for null/undefined", () => {
		expect(escapeHtml(null)).toBe("");
		expect(escapeHtml(undefined)).toBe("");
	});

	it("returns the input unchanged when no special chars", () => {
		expect(escapeHtml("plain text 123")).toBe("plain text 123");
	});
});

describe("renderInvoiceHtml", () => {
	it("includes core invoice fields in the output", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).toContain("INV-001");
		expect(html).toContain("Acme LLC");
		expect(html).toContain("Customer Co");
		expect(html).toContain("buyer@example.com");
		expect(html).toContain("$500.00"); // 50000 cents
		expect(html).toContain("Design");
		expect(html).toContain("Build");
	});

	it("renders Venmo and PayPal deep links when handles are set", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).toContain("venmo.com/u/acme-llc");
		expect(html).toContain("txn=charge");
		expect(html).toContain("amount=500.00");
		expect(html).toContain("paypal.me/acmellc/500.00USD");
	});

	it("omits Venmo / PayPal sections when handles are null", () => {
		const snap = baseSnapshot();
		snap.seller.venmoHandle = null;
		snap.seller.paypalHandle = null;
		const html = renderInvoiceHtml(snap);
		expect(html).not.toContain("venmo.com");
		expect(html).not.toContain("paypal.me");
		expect(html).toContain("Contact the sender for payment instructions.");
	});

	it("escapes XSS in description (no raw <script>)", () => {
		const snap = baseSnapshot();
		snap.invoice.description = '<script>alert("xss")</script>';
		const html = renderInvoiceHtml(snap);
		expect(html).not.toContain('<script>alert("xss")</script>');
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes XSS in customer name", () => {
		const snap = baseSnapshot();
		snap.buyer.name = '<img src=x onerror="alert(1)">';
		const html = renderInvoiceHtml(snap);
		expect(html).not.toContain('<img src=x onerror="alert(1)">');
		expect(html).toContain("&lt;img");
	});

	it("escapes XSS in line item descriptions", () => {
		const snap = baseSnapshot();
		snap.lineItems[0].description = "<b>bold</b>";
		const html = renderInvoiceHtml(snap);
		expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
	});

	it("converts newlines in business / buyer address to <br />", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).toContain("123 Main St<br />Springfield");
	});

	it("shows a DRAFT banner when isDraftPreview is true", () => {
		const html = renderInvoiceHtml(baseSnapshot(), { isDraftPreview: true });
		expect(html).toContain("DRAFT PREVIEW");
	});

	it("hides the DRAFT banner by default", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).not.toContain("DRAFT PREVIEW");
	});

	it("includes the hostedUrl link when supplied", () => {
		const html = renderInvoiceHtml(baseSnapshot(), {
			hostedUrl: "https://example.com/invoice/abc",
		});
		expect(html).toContain("https://example.com/invoice/abc");
		expect(html).toContain("View this invoice online");
	});

	it("includes the revoke link when supplied", () => {
		const html = renderInvoiceHtml(baseSnapshot(), {
			revokeUrl: "https://example.com/consent/revoke/xyz",
		});
		expect(html).toContain("Revoke consent");
		expect(html).toContain("https://example.com/consent/revoke/xyz");
	});

	it("omits the seen-beacon img when seenBeaconUrl is not set", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).not.toContain('<img src="');
	});

	it("includes the seen-beacon img when seenBeaconUrl is set", () => {
		const html = renderInvoiceHtml(baseSnapshot(), {
			seenBeaconUrl: "https://example.com/invoice/abc/seen",
		});
		expect(html).toContain("https://example.com/invoice/abc/seen");
		expect(html).toContain('width="1"');
		expect(html).toContain('height="1"');
	});

	it("sets the no-referrer meta tag (token leak prevention)", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).toContain('name="referrer"');
		expect(html).toContain('content="no-referrer"');
	});

	it("sets robots noindex,nofollow", () => {
		const html = renderInvoiceHtml(baseSnapshot());
		expect(html).toContain('name="robots"');
		expect(html).toContain('content="noindex,nofollow"');
	});

	it("renders no line-item table when lineItems is empty", () => {
		const snap = baseSnapshot();
		snap.lineItems = [];
		const html = renderInvoiceHtml(snap);
		expect(html).not.toContain("<table class=\"lines\">");
	});

	it("formats minutes as hours with 2 decimals", () => {
		const snap = baseSnapshot();
		snap.lineItems = [
			{ date: "2026-05-01", description: "x", minutes: 90, amountCents: 100 },
		];
		const html = renderInvoiceHtml(snap);
		expect(html).toContain("1.50 h");
	});

	it("renders empty minutes cell when minutes is null", () => {
		const snap = baseSnapshot();
		snap.lineItems = [
			{ date: null, description: "x", minutes: null, amountCents: 100 },
		];
		const html = renderInvoiceHtml(snap);
		// no "h" suffix should appear for this row
		expect(html).not.toContain(" h</td>");
	});

	it("URL-encodes Venmo / PayPal handles with special characters", () => {
		const snap = baseSnapshot();
		snap.seller.venmoHandle = "weird handle";
		snap.seller.paypalHandle = "a/b";
		const html = renderInvoiceHtml(snap);
		expect(html).toContain("venmo.com/u/weird%20handle");
		expect(html).toContain("paypal.me/a%2Fb/");
	});
});
