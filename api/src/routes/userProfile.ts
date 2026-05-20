import { Hono } from "hono";
import { z } from "zod";
import { decrypt, type EncryptionContext, encrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env, UserProfile } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const updateProfileSchema = z.object({
	displayName: z.string().trim().max(200).default(""),
	venmoHandle: z.string().trim().max(120).optional().nullable(),
	paypalHandle: z.string().trim().max(120).optional().nullable(),
	businessName: z.string().trim().max(200).optional().nullable(),
	businessAddress: z.string().trim().max(1000).optional().nullable(),
	// Per-user Resend config. `resendApiKey` is write-only:
	//   - omit / undefined  -> leave existing value untouched
	//   - empty string / null -> clear the stored key
	//   - non-empty string  -> replace the stored key
	// `resendFromAddress` is symmetric but returned in plaintext on GET.
	resendApiKey: z.string().trim().max(200).optional().nullable(),
	resendFromAddress: z.string().trim().max(200).optional().nullable(),
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
	resendApiKey: string | null;
	resendFromAddress: string | null;
	createdAt: string;
	updatedAt: string;
};

const decryptProfile = async (
	row: DbUserRow,
	ctx: EncryptionContext,
): Promise<UserProfile> => ({
	id: row.id,
	uuid: row.uuid,
	displayName: row.displayName,
	email: row.email,
	venmoHandle: row.venmoHandle ? await decrypt(row.venmoHandle, ctx) : null,
	paypalHandle: row.paypalHandle ? await decrypt(row.paypalHandle, ctx) : null,
	businessName: row.businessName ? await decrypt(row.businessName, ctx) : null,
	businessAddress: row.businessAddress
		? await decrypt(row.businessAddress, ctx)
		: null,
	hasResendApiKey: row.resendApiKey != null,
	resendFromAddress: row.resendFromAddress
		? await decrypt(row.resendFromAddress, ctx)
		: null,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

const USER_SELECT = `SELECT id, uuid, displayName, email, venmoHandle, paypalHandle,
	        businessName, businessAddress, resendApiKey, resendFromAddress,
	        createdAt, updatedAt
	 FROM users WHERE id = ?`;

// GET /api/v1/user-profile
app.get("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");
	const enc = c.get("dek");

	const row = await db.prepare(USER_SELECT).bind(userId).first<DbUserRow>();

	if (!row) {
		return c.json({ error: "User not found" }, 404);
	}

	return c.json(await decryptProfile(row, enc));
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
	const enc = c.get("dek");

	const encOrNull = async (v: string | null | undefined) =>
		v && v.length > 0 ? await encrypt(v, enc) : null;

	await db
		.prepare(
			`UPDATE users
			 SET displayName = ?,
			     venmoHandle = ?, paypalHandle = ?,
			     businessName = ?, businessAddress = ?,
			     resendFromAddress = ?
			 WHERE id = ?`,
		)
		.bind(
			body.displayName,
			await encOrNull(body.venmoHandle),
			await encOrNull(body.paypalHandle),
			await encOrNull(body.businessName),
			await encOrNull(body.businessAddress),
			await encOrNull(body.resendFromAddress),
			userId,
		)
		.run();

	// `resendApiKey` is write-only with three-state semantics: undefined =
	// leave existing value untouched, null/"" = clear, non-empty = replace.
	// A separate UPDATE so we only touch it when the client opted in.
	if (body.resendApiKey !== undefined) {
		await db
			.prepare("UPDATE users SET resendApiKey = ? WHERE id = ?")
			.bind(await encOrNull(body.resendApiKey), userId)
			.run();
	}

	const updated = await db.prepare(USER_SELECT).bind(userId).first<DbUserRow>();
	if (!updated) return c.json({ error: "User not found" }, 404);
	return c.json(await decryptProfile(updated, enc));
});

// DELETE /api/v1/user-profile — wipe all user-generated data (keeps account)
app.delete("/", async (c) => {
	const db = getDb(c.env);
	const userId = c.get("userId");

	// Collect R2 keys from the attachments table — it's the source of
	// truth for file ownership now. This catches both attached files AND
	// orphaned/pending ones that the per-transaction scan above used to
	// miss.
	const { results: attRows } = await db
		.prepare("SELECT id FROM attachments WHERE userId = ?")
		.bind(userId)
		.all<{ id: string }>();

	await Promise.all(
		attRows.map((r: { id: string }) => c.env.FILES_BUCKET.delete(r.id)),
	);

	await db
		.prepare("DELETE FROM attachments WHERE userId = ?")
		.bind(userId)
		.run();

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

	// Clear profile fields on the users row — keeps the account but resets
	// all user-entered invoice profile and payment handle data.
	await db
		.prepare(
			`UPDATE users
			 SET venmoHandle = NULL, paypalHandle = NULL,
			     businessName = NULL, businessAddress = NULL,
			     resendApiKey = NULL, resendFromAddress = NULL
			 WHERE id = ?`,
		)
		.bind(userId)
		.run();

	return c.json({ deleted: true });
});

export { app as userProfileRoutes };
