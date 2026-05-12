import { Hono } from "hono";
import { z } from "zod";
import { decrypt, encrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env, UserProfile } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const updateProfileSchema = z.object({
	displayName: z.string().trim().max(200).default(""),
	email: z.string().trim().email().max(320),
	venmoHandle: z.string().trim().max(120).optional().nullable(),
	paypalHandle: z.string().trim().max(120).optional().nullable(),
	businessName: z.string().trim().max(200).optional().nullable(),
	businessAddress: z.string().trim().max(1000).optional().nullable(),
});

type DbUserRow = {
	id: number;
	uuid: string;
	displayName: string;
	email: string;
	venmoHandle: string | null;
	paypalHandle: string | null;
	businessName: string | null;
	businessAddress: string | null;
	createdAt: string;
	updatedAt: string;
};

const decryptProfile = async (
	row: DbUserRow,
	env: Env,
): Promise<UserProfile> => ({
	id: row.id,
	uuid: row.uuid,
	displayName: row.displayName,
	email: row.email,
	venmoHandle: row.venmoHandle ? await decrypt(row.venmoHandle, env) : null,
	paypalHandle: row.paypalHandle ? await decrypt(row.paypalHandle, env) : null,
	businessName: row.businessName
		? await decrypt(row.businessName, env)
		: null,
	businessAddress: row.businessAddress
		? await decrypt(row.businessAddress, env)
		: null,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

// GET /api/v1/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	const row = await db
		.prepare(
			`SELECT id, uuid, displayName, email, venmoHandle, paypalHandle,
			        businessName, businessAddress, createdAt, updatedAt
			 FROM users WHERE id = ?`,
		)
		.bind(userId)
		.first<DbUserRow>();

	if (!row) {
		return c.json({ error: "User not found" }, 404);
	}

	return c.json(await decryptProfile(row, c.env));
});

// PUT /api/v1/user-profile
app.put("/", async (c) => {
	const parsed = updateProfileSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid profile", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	const encOrNull = async (v: string | null | undefined) =>
		v && v.length > 0 ? await encrypt(v, c.env) : null;

	await db
		.prepare(
			`UPDATE users
			 SET displayName = ?, email = ?,
			     venmoHandle = ?, paypalHandle = ?,
			     businessName = ?, businessAddress = ?
			 WHERE id = ?`,
		)
		.bind(
			body.displayName,
			body.email,
			await encOrNull(body.venmoHandle),
			await encOrNull(body.paypalHandle),
			await encOrNull(body.businessName),
			await encOrNull(body.businessAddress),
			userId,
		)
		.run();

	const updated = await db
		.prepare(
			`SELECT id, uuid, displayName, email, venmoHandle, paypalHandle,
			        businessName, businessAddress, createdAt, updatedAt
			 FROM users WHERE id = ?`,
		)
		.bind(userId)
		.first<DbUserRow>();
	if (!updated) return c.json({ error: "User not found" }, 404);
	return c.json(await decryptProfile(updated, c.env));
});

// DELETE /api/v1/user-profile — wipe all user-generated data (keeps account)
app.delete("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	// Collect R2 keys from all transactions before deleting DB rows
	const { results: txRows } = await db
		.prepare(
			"SELECT filePath FROM transactions WHERE userId = ? AND filePath IS NOT NULL AND filePath != ''",
		)
		.bind(userId)
		.all<{ filePath: string }>();

	const r2Keys = txRows
		.map((r) => r.filePath)
		.filter((p) => !/^https?:\/\//i.test(p));

	await Promise.all(r2Keys.map((key) => c.env.FILES_BUCKET.delete(key)));

	// Invoices reference customers (RESTRICT) so wipe them first.
	await db
		.prepare("DELETE FROM invoice_events WHERE userId = ?")
		.bind(userId)
		.run();
	await db.prepare("DELETE FROM invoices WHERE userId = ?").bind(userId).run();
	await db
		.prepare("DELETE FROM customer_events WHERE userId = ?")
		.bind(userId)
		.run();
	await db.prepare("DELETE FROM customers WHERE userId = ?").bind(userId).run();

	// Projects cascade to timesheets, timesheet_entries, and transactions
	await db.prepare("DELETE FROM projects WHERE userId = ?").bind(userId).run();

	// Transactions not linked to a project (e.g. created directly)
	await db
		.prepare("DELETE FROM transactions WHERE userId = ?")
		.bind(userId)
		.run();

	await db
		.prepare("DELETE FROM send_rate_log WHERE userId = ?")
		.bind(userId)
		.run();

	return c.json({ deleted: true });
});

export { app as userProfileRoutes };
