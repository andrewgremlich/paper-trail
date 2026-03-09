import { Hono } from "hono";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import { getUserProfile } from "../lib/userId";

const app = new Hono<{ Bindings: Env }>();

// GET /api/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const profile = await getUserProfile(db);
	return c.json(profile);
});

// PUT /api/user-profile
app.put("/", async (c) => {
	const body = await c.req.json<{
		displayName: string;
		email: string;
	}>();
	const db = getDb(c.env);
	const existing = await getUserProfile(db);

	await db.execute({
		sql: "UPDATE user_profile SET displayName = ?, email = ? WHERE id = ?",
		args: [body.displayName, body.email, existing.id],
	});

	const updated = await db.execute({
		sql: "SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile WHERE id = ?",
		args: [existing.id],
	});

	return c.json(updated.rows[0]);
});

export { app as userProfileRoutes };
