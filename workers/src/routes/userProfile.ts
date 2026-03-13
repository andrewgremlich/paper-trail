import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// GET /api/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const result = await db.execute({
		sql: "SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile WHERE id = ?",
		args: [userId],
	});

	if (result.rows.length === 0) {
		return c.json({ error: "User not found" }, 404);
	}

	return c.json(result.rows[0]);
});

// PUT /api/user-profile
app.put("/", async (c) => {
	const body = await c.req.json<{
		displayName: string;
		email: string;
	}>();
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db.execute({
		sql: "UPDATE user_profile SET displayName = ?, email = ? WHERE id = ?",
		args: [body.displayName, body.email, userId],
	});

	const updated = await db.execute({
		sql: "SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile WHERE id = ?",
		args: [userId],
	});

	return c.json(updated.rows[0]);
});

export { app as userProfileRoutes };
