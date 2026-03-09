import { Hono } from "hono";
import { cors } from "hono/cors";
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

app.route("/api/projects", projectRoutes);
app.route("/api/timesheets", timesheetRoutes);
app.route("/api/timesheet-entries", timesheetEntryRoutes);
app.route("/api/transactions", transactionRoutes);
app.route("/api/user-profile", userProfileRoutes);
app.route("/api/stripe", stripeRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/export", exportImportRoutes);
app.route("/api/import", exportImportRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

export default app;
