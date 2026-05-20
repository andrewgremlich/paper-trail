import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import type { AuthVariables } from "./middleware/auth";
import { clerkAuth } from "./middleware/auth";
import { attachmentRoutes } from "./routes/attachments";
import { consentRoutes } from "./routes/consent";
import { customerRoutes } from "./routes/customers";
import { dekMigrationRoutes } from "./routes/dekMigration";
import { exportImportRoutes } from "./routes/exportImport";
import { fileRoutes } from "./routes/files";
import { runAttachmentSweep } from "./scheduled";
import { invoiceRoutes } from "./routes/invoices";
import { projectRoutes } from "./routes/projects";
import { publicInvoiceRoutes } from "./routes/publicInvoice";
import { timesheetEntryRoutes } from "./routes/timesheetEntries";
import { timesheetRoutes } from "./routes/timesheets";
import { transactionRoutes } from "./routes/transactions";
import { userProfileRoutes } from "./routes/userProfile";

const app = new Hono<{ Bindings: Env }>();

// CORS is restricted to the configured app origin. The frontend and API
// are served from the same Worker so cross-origin requests are not part
// of the normal flow — reflecting arbitrary origins with credentials
// would let any site read authenticated API responses through the user's
// active Cloudflare Access session.
app.use("/*", async (c, next) => {
	const allowed = c.env.APP_BASE_URL?.replace(/\/$/, "");
	return cors({
		origin: (origin) => (allowed && origin === allowed ? origin : null),
		credentials: true,
	})(c, next);
});

// Public, unauthenticated routes (mounted BEFORE the v1 auth middleware).
// These serve the customer-facing pages — the customer doesn't have a
// Cloudflare Access session.
app.route("/invoice", publicInvoiceRoutes);
app.route("/consent", consentRoutes);

// v1 API routes
const v1 = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Default-secure response headers for every authenticated response.
// `Cache-Control: no-store` keeps PII out of shared caches even if a
// route forgets to set it explicitly; HSTS reinforces the edge-managed
// header so misrouted traffic still gets it.
v1.use("/*", async (c, next) => {
	await next();
	if (!c.res.headers.has("Cache-Control")) {
		c.header("Cache-Control", "no-store");
	}
	c.header(
		"Strict-Transport-Security",
		"max-age=63072000; includeSubDomains",
	);
});

// Apply Clerk auth to all v1 routes
v1.use("/*", clerkAuth);

v1.route("/projects", projectRoutes);
v1.route("/timesheets", timesheetRoutes);
v1.route("/timesheet-entries", timesheetEntryRoutes);
v1.route("/transactions", transactionRoutes);
v1.route("/user-profile", userProfileRoutes);
v1.route("/customers", customerRoutes);
v1.route("/invoices", invoiceRoutes);
v1.route("/files", fileRoutes);
v1.route("/attachments", attachmentRoutes);
v1.route("/export", exportImportRoutes);
v1.route("/import", exportImportRoutes);
v1.route("/migrate-dek", dekMigrationRoutes);
v1.get("/health", (c) => c.json({ status: "ok", version: "v1" }));

app.route("/api/v1", v1);

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			runAttachmentSweep(env).then((result) => {
				console.log("attachment sweep complete", result);
			}),
		);
	},
} satisfies ExportedHandler<Env>;
