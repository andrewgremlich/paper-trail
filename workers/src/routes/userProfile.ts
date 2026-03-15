import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare("SELECT id, uuid, displayName, email, createdAt, updatedAt FROM users WHERE id = ?")
		.bind(userId)
		.first();

	if (!row) {
		return c.json({ error: "User not found" }, 404);
	}

	return c.json(row);
});

// PUT /api/user-profile
app.put("/", async (c) => {
	const body = await c.req.json<{
		displayName: string;
		email: string;
	}>();
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("UPDATE users SET displayName = ?, email = ? WHERE id = ?")
		.bind(body.displayName, body.email, userId)
		.run();

	const updated = await db
		.prepare("SELECT id, uuid, displayName, email, createdAt, updatedAt FROM users WHERE id = ?")
		.bind(userId)
		.first();

	return c.json(updated);
});

export { app as userProfileRoutes };
