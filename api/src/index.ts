import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import type { AuthVariables } from "./middleware/auth";
import { cfAccessAuth } from "./middleware/auth";
import { exportImportRoutes } from "./routes/exportImport";
import { fileRoutes } from "./routes/files";
import { projectRoutes } from "./routes/projects";
import { stripeRoutes } from "./routes/stripe";
import { timesheetEntryRoutes } from "./routes/timesheetEntries";
import { timesheetRoutes } from "./routes/timesheets";
import { transactionRoutes } from "./routes/transactions";
import { userProfileRoutes } from "./routes/userProfile";

const app = new Hono();

app.use(
	"/*",
	cors({
		origin: (origin) => origin,
		credentials: true,
	}),
);

// v1 API routes
const v1 = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply Cloudflare Access auth to all v1 routes
v1.use("/*", cfAccessAuth);

v1.route("/projects", projectRoutes);
v1.route("/timesheets", timesheetRoutes);
v1.route("/timesheet-entries", timesheetEntryRoutes);
v1.route("/transactions", transactionRoutes);
v1.route("/user-profile", userProfileRoutes);
v1.route("/stripe", stripeRoutes);
v1.route("/files", fileRoutes);
v1.route("/export", exportImportRoutes);
v1.route("/import", exportImportRoutes);
v1.get("/health", (c) => c.json({ status: "ok", version: "v1" }));

app.route("/api/v1", v1);

export default app;
