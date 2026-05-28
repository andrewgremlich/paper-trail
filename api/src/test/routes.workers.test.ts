/**
 * Happy-path end-to-end tests for each route module.
 *
 * Runs inside workerd via @cloudflare/vitest-pool-workers. SELF is the
 * worker's default export, so every request goes through the real
 * Hono app, the real auth middleware (Clerk bypass mode), real D1,
 * and real R2. The doc's §1.2 floor asks for "one end-to-end
 * happy-path test per route module" — this file is that.
 */

import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// biome-ignore lint/suspicious/noExplicitAny: test bindings include TEST_MIGRATIONS not in Env
const testEnv = env as any;

const url = (path: string) => `http://localhost${path}`;

// Reset all user-owned tables + R2 between tests so each test is
// hermetic. The bypass user (id=1 after first auth call) is left in
// place — the middleware would otherwise re-provision it anyway.
const resetState = async () => {
	const db = testEnv.DB as D1Database;
	await db.batch([
		db.prepare("DELETE FROM invoice_events"),
		db.prepare("DELETE FROM customer_events"),
		db.prepare("DELETE FROM invoices"),
		db.prepare("DELETE FROM timesheet_entries"),
		db.prepare("DELETE FROM timesheets"),
		db.prepare("DELETE FROM transactions"),
		db.prepare("DELETE FROM attachments"),
		db.prepare("DELETE FROM customers"),
		db.prepare("DELETE FROM projects"),
		db.prepare("DELETE FROM send_rate_log"),
	]);
	// R2: list + delete every key. Bucket is small in tests so this is fine.
	const bucket = testEnv.FILES_BUCKET as R2Bucket;
	let cursor: string | undefined;
	do {
		const list = await bucket.list({ cursor });
		await Promise.all(list.objects.map((o) => bucket.delete(o.key)));
		cursor = list.truncated ? list.cursor : undefined;
	} while (cursor);
};

beforeEach(async () => {
	await resetState();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------
// /api/v1/user-profile
// ---------------------------------------------------------------------
describe("userProfile route", () => {
	it("GET returns the auto-provisioned user, PUT round-trips business fields", async () => {
		const get = await SELF.fetch(url("/api/v1/user-profile"));
		expect(get.status).toBe(200);
		const me = (await get.json()) as { id: number; email: string };
		expect(me.email).toBe("test@localhost.dev");

		const put = await SELF.fetch(url("/api/v1/user-profile"), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				displayName: "Test Operator",
				venmoHandle: "test-venmo",
				paypalHandle: "test-paypal",
				businessName: "Test Co",
				businessAddress: "1 Main St",
				resendFromAddress: "Test <test@example.com>",
			}),
		});
		expect(put.status).toBe(200);
		const updated = (await put.json()) as {
			displayName: string;
			venmoHandle: string;
			businessName: string;
		};
		expect(updated.displayName).toBe("Test Operator");
		expect(updated.venmoHandle).toBe("test-venmo");
		expect(updated.businessName).toBe("Test Co");
	});
});

// ---------------------------------------------------------------------
// /api/v1/customers
// ---------------------------------------------------------------------
describe("customers route", () => {
	it("POST then GET round-trips encrypted name/email/address", async () => {
		const post = await SELF.fetch(url("/api/v1/customers"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Acme Corp",
				email: "billing@acme.example",
				address: "123 Main\nSpringfield",
			}),
		});
		expect(post.status).toBeLessThan(300);

		const list = await SELF.fetch(url("/api/v1/customers"));
		expect(list.status).toBe(200);
		const customers = (await list.json()) as Array<{
			id: string;
			name: string;
			email: string;
			address: string;
		}>;
		expect(customers).toHaveLength(1);
		expect(customers[0].name).toBe("Acme Corp");
		expect(customers[0].email).toBe("billing@acme.example");
		expect(customers[0].address).toBe("123 Main\nSpringfield");
	});
});

// ---------------------------------------------------------------------
// /api/v1/projects
// ---------------------------------------------------------------------
describe("projects route", () => {
	it("POST creates a project, GET lists it with decrypted rate + description", async () => {
		const post = await SELF.fetch(url("/api/v1/projects"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Website Redesign",
				rate_in_cents: 12500,
				description: "Hourly design + dev",
			}),
		});
		expect(post.status).toBe(201);
		const created = (await post.json()) as {
			project: { id: string; rate_in_cents: number };
		};
		expect(created.project.rate_in_cents).toBe(12500);

		const list = await SELF.fetch(url("/api/v1/projects"));
		const projects = (await list.json()) as Array<{
			name: string;
			rate_in_cents: number;
			description: string;
			active: boolean;
		}>;
		expect(projects).toHaveLength(1);
		expect(projects[0].name).toBe("Website Redesign");
		expect(projects[0].rate_in_cents).toBe(12500);
		expect(projects[0].description).toBe("Hourly design + dev");
		expect(projects[0].active).toBe(true);
	});
});

// ---------------------------------------------------------------------
// /api/v1/timesheets
// ---------------------------------------------------------------------
describe("timesheets route", () => {
	it("POST creates a timesheet linked to a project, GET lists it", async () => {
		const projectPost = await SELF.fetch(url("/api/v1/projects"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Proj-A",
				rate_in_cents: 10000,
				description: "",
			}),
		});
		const proj = ((await projectPost.json()) as { project: { id: string } })
			.project;

		const post = await SELF.fetch(url("/api/v1/timesheets"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectId: proj.id,
				name: "Week 1",
				description: "First week of work",
			}),
		});
		expect(post.status).toBe(201);
		const sheet = (await post.json()) as { id: string; name: string };
		expect(sheet.name).toBe("Week 1");

		const list = await SELF.fetch(url("/api/v1/timesheets"));
		const sheets = (await list.json()) as Array<{ name: string }>;
		expect(sheets.map((s) => s.name)).toContain("Week 1");
	});
});

// ---------------------------------------------------------------------
// /api/v1/timesheet-entries
// ---------------------------------------------------------------------
describe("timesheetEntries route", () => {
	it("POST creates an entry under a timesheet, GET of timesheet lists it", async () => {
		const projectPost = await SELF.fetch(url("/api/v1/projects"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "P",
				rate_in_cents: 10000,
				description: "",
			}),
		});
		const proj = ((await projectPost.json()) as { project: { id: string } })
			.project;
		const tsPost = await SELF.fetch(url("/api/v1/timesheets"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ projectId: proj.id, name: "TS" }),
		});
		const ts = (await tsPost.json()) as { id: string };

		const post = await SELF.fetch(url("/api/v1/timesheet-entries"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				timesheetId: ts.id,
				date: "2026-05-16",
				minutes: 60,
				description: "Pair on docs",
				amount: 10000,
			}),
		});
		expect(post.status).toBe(201);
		const created = (await post.json()) as { success: boolean; id: string };
		expect(created.success).toBe(true);

		const detail = await SELF.fetch(url(`/api/v1/timesheets/${ts.id}`));
		const tsDetail = (await detail.json()) as {
			entries: Array<{ description: string }>;
		};
		expect(tsDetail.entries).toHaveLength(1);
		expect(tsDetail.entries[0].description).toBe("Pair on docs");
	});
});

// ---------------------------------------------------------------------
// /api/v1/transactions
// ---------------------------------------------------------------------
describe("transactions route", () => {
	it("POST creates a transaction, GET lists it with decrypted amount", async () => {
		const projectPost = await SELF.fetch(url("/api/v1/projects"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "P",
				rate_in_cents: 10000,
				description: "",
			}),
		});
		const proj = ((await projectPost.json()) as { project: { id: string } })
			.project;

		const post = await SELF.fetch(url("/api/v1/transactions"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				projectId: proj.id,
				date: "2026-05-16",
				description: "Hosting",
				amount: 12.34,
				filePath: null,
			}),
		});
		expect(post.status).toBe(201);

		const list = await SELF.fetch(
			url(`/api/v1/transactions?projectId=${proj.id}`),
		);
		const txns = (await list.json()) as Array<{
			description: string;
			amount: number;
		}>;
		expect(txns).toHaveLength(1);
		expect(txns[0].description).toBe("Hosting");
		expect(txns[0].amount).toBeCloseTo(12.34, 2);
	});
});

// ---------------------------------------------------------------------
// /api/v1/files + /api/v1/attachments
// ---------------------------------------------------------------------
describe("files + attachments routes", () => {
	it("uploads a file, lists it via attachments, downloads it, deletes it", async () => {
		const fd = new FormData();
		const fileBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
		fd.set(
			"file",
			new File([fileBytes], "doc.pdf", { type: "application/pdf" }),
		);

		const upload = await SELF.fetch(url("/api/v1/files/upload"), {
			method: "POST",
			body: fd,
		});
		expect(upload.status).toBe(201);
		const { key, originalName } = (await upload.json()) as {
			key: string;
			originalName: string;
		};
		expect(originalName).toBe("doc.pdf");
		expect(key).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);

		// Pending uploads under 10 min are hidden from the list, but the
		// summary counts them.
		const summary = await SELF.fetch(url("/api/v1/attachments/summary"));
		const s = (await summary.json()) as { total: number; pending: number };
		expect(s.total).toBe(1);
		expect(s.pending).toBe(1);

		// Download — round-trips the encrypted bytes back to plaintext.
		const download = await SELF.fetch(url(`/api/v1/files/${key}`));
		expect(download.status).toBe(200);
		const downloaded = new Uint8Array(await download.arrayBuffer());
		expect(downloaded).toEqual(fileBytes);
		expect(download.headers.get("Content-Disposition")).toContain("doc.pdf");

		// Delete.
		const del = await SELF.fetch(url(`/api/v1/files/${key}`), {
			method: "DELETE",
		});
		expect(del.status).toBeLessThan(300);
	});
});

// ---------------------------------------------------------------------
// /api/v1/invoices
// ---------------------------------------------------------------------
describe("invoices route", () => {
	it("POST creates a draft invoice from a customer + amount, GET lists + reads it", async () => {
		const custPost = await SELF.fetch(url("/api/v1/customers"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Buyer",
				email: "buyer@example.com",
				address: "1 Buyer Way",
			}),
		});
		expect(custPost.status).toBeLessThan(300);
		const customers = (await (
			await SELF.fetch(url("/api/v1/customers"))
		).json()) as Array<{ id: string }>;
		const customerId = customers[0].id;

		const post = await SELF.fetch(url("/api/v1/invoices"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				customerId,
				amountCents: 50000,
				description: "Consulting — May",
				issuedAt: "2026-05-01",
				dueDate: "2026-05-31",
			}),
		});
		expect(post.status).toBe(201);
		const created = (await post.json()) as {
			id: string;
			number: string;
			success: boolean;
		};
		expect(created.success).toBe(true);
		expect(created.number).toMatch(/^INV-\d{4}-\d{4}$/);

		const list = await SELF.fetch(url("/api/v1/invoices"));
		const invoices = (await list.json()) as Array<{
			id: string;
			status: string;
		}>;
		expect(invoices).toHaveLength(1);
		expect(invoices[0].status).toBe("draft");

		const single = await SELF.fetch(url(`/api/v1/invoices/${created.id}`));
		expect(single.status).toBe(200);
		const inv = (await single.json()) as {
			amount_cents: number;
			description: string;
		};
		expect(inv.amount_cents).toBe(50000);
		expect(inv.description).toBe("Consulting — May");
	});
});

// ---------------------------------------------------------------------
// /api/v1/export + /api/v1/import
// ---------------------------------------------------------------------
describe("exportImport route", () => {
	it("GET /export/data returns a JSON snapshot of the user's data", async () => {
		// Seed a tiny graph: customer + project.
		await SELF.fetch(url("/api/v1/customers"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Export Cust",
				email: "x@example.com",
				address: null,
			}),
		});
		await SELF.fetch(url("/api/v1/projects"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Export Proj",
				rate_in_cents: 9999,
				description: "for export",
			}),
		});

		const exp = await SELF.fetch(url("/api/v1/export/data"));
		expect(exp.status).toBe(200);
		const data = (await exp.json()) as {
			version: string;
			projects: unknown[];
			customers?: unknown[];
		};
		expect(data.version).toBeDefined();
		expect(data.projects).toHaveLength(1);
		expect(data.customers).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------
// /api/v1/health (smoke + the v1 default-secure header middleware)
// ---------------------------------------------------------------------
describe("v1 middleware", () => {
	it("GET /api/v1/health sets HSTS and defaults Cache-Control to no-store", async () => {
		const res = await SELF.fetch(url("/api/v1/health"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Strict-Transport-Security")).toContain(
			"max-age=63072000",
		);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		const body = (await res.json()) as { status: string; version: string };
		expect(body.status).toBe("ok");
		expect(body.version).toBe("v1");
	});
});

// ---------------------------------------------------------------------
// /consent/:token (public, unauthenticated)
// ---------------------------------------------------------------------
describe("consent route", () => {
	it("GET /consent/:token renders the agree/decline page for a valid token", async () => {
		// Seed a customer with a consent token directly in D1 (the
		// /customers POST creates a consent token via /request-consent
		// which tries to send a Resend email — we don't want that here).
		const db = testEnv.DB as D1Database;
		const userRow = await db
			.prepare("SELECT id FROM users WHERE email = ?")
			.bind("test@localhost.dev")
			.first<{ id: number }>();
		// If the bypass user wasn't auto-provisioned yet, hit any v1 route
		// to trigger the upsert. (Health check is the cheapest.)
		let userId = userRow?.id;
		if (!userId) {
			await SELF.fetch(url("/api/v1/health"));
			const again = await db
				.prepare("SELECT id FROM users WHERE email = ?")
				.bind("test@localhost.dev")
				.first<{ id: number }>();
			userId = again?.id;
		}
		if (!userId) throw new Error("bypass user not provisioned");

		const customerId = crypto.randomUUID();
		const consentToken = "deadbeef".repeat(8); // 64 hex chars, like the real ones
		const now = new Date().toISOString();
		// `name` / `email` columns are encrypted-at-rest in production; the
		// public consent route decrypts them. `decrypt()` passes through
		// unencrypted values unchanged, so plaintext is fine for this test.
		await db
			.prepare(
				`INSERT INTO customers
				 (id, userId, name, email, address, consentToEmailInvoices,
				  consentRequestedAt, consentToken)
				 VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
			)
			.bind(
				customerId,
				userId,
				"Buyer Co",
				"buyer@example.com",
				now,
				consentToken,
			)
			.run();

		const res = await SELF.fetch(url(`/consent/${consentToken}`));
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Consent to receive invoices by email");
		expect(html).toContain("buyer@example.com");
		// CSRF cookie issued for the form POST
		expect(res.headers.get("Set-Cookie")).toContain("pt_consent_csrf=");
	});
});

// ---------------------------------------------------------------------
// /invoice/:id (public hosted invoice page)
// ---------------------------------------------------------------------
describe("publicInvoice route", () => {
	it("returns 404 for an unknown invoice", async () => {
		const res = await SELF.fetch(
			url("/invoice/00000000-0000-0000-0000-000000000000?t=anything"),
		);
		expect(res.status).toBe(404);
		const html = await res.text();
		expect(html).toContain("Invoice not found");
	});
});
