import { Hono } from "hono";
import { decrypt, encrypt, encryptBuffer, decryptBuffer, isEncrypted, loadUserDek, isEncryptionEnabled } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Re-encrypt a nullable ciphertext column from legacy key → DEK.
// Returns the new ciphertext, or null if the value is null/empty.
// If the value is already plaintext (no `enc:` prefix) it is encrypted
// under the DEK directly — handles the no-encryption case gracefully.
async function reencrypt(
	value: string | null | undefined,
	legacyCtx: Env,
	dek: CryptoKey,
): Promise<string | null> {
	if (value == null || value === "") return null;
	// decrypt() passes through values that don't start with `enc:`, so this
	// is safe whether or not encryption was previously enabled.
	const plaintext = await decrypt(value, legacyCtx);
	return encrypt(plaintext, dek);
}

// POST /api/v1/migrate-dek
//
// Re-encrypts every legacy-key ciphertext row owned by the authenticated
// user under their per-user DEK. Idempotent: rows already encrypted under
// the DEK are a no-op (decrypt under legacy key falls through to plaintext,
// then re-encrypt — AES-GCM is randomised, but the plaintext is the same).
//
// Requires DEK_MIGRATION_ENABLED=true. Without a provisioned DEK this
// endpoint returns 412.
//
// The migration runs in a single request. For large datasets the Worker's
// 30s CPU limit could be a constraint — in that case call the endpoint
// repeatedly (it is safe to retry any subset).
app.post("/", async (c) => {
	if (c.env.DEK_MIGRATION_ENABLED !== "true") {
		return c.json({ error: "DEK migration is not enabled" }, 403);
	}

	const dek = c.get("dek");
	if (!dek) {
		return c.json(
			{ error: "No DEK provisioned for this user — sign in again to provision one" },
			412,
		);
	}

	const userId = c.get("userId");
	const db = getDb(c.env);
	// `c.env` carries the legacy ENCRYPTION_KEY / KEK_V1 and is used as the
	// decrypt context for all existing ciphertext. The per-user `dek` is the
	// encrypt context for all re-encrypted output.
	const legacyCtx = c.env;

	let rowsMigrated = 0;

	// ── users (profile fields) ──────────────────────────────────────────────
	{
		const row = await db
			.prepare(
				`SELECT venmoHandle, paypalHandle, businessName, businessAddress,
				        resendApiKey, resendFromAddress
				 FROM users WHERE id = ?`,
			)
			.bind(userId)
			.first<{
				venmoHandle: string | null;
				paypalHandle: string | null;
				businessName: string | null;
				businessAddress: string | null;
				resendApiKey: string | null;
				resendFromAddress: string | null;
			}>();
		if (row) {
			await db
				.prepare(
					`UPDATE users
					 SET venmoHandle = ?, paypalHandle = ?,
					     businessName = ?, businessAddress = ?,
					     resendApiKey = ?, resendFromAddress = ?
					 WHERE id = ?`,
				)
				.bind(
					await reencrypt(row.venmoHandle, legacyCtx, dek),
					await reencrypt(row.paypalHandle, legacyCtx, dek),
					await reencrypt(row.businessName, legacyCtx, dek),
					await reencrypt(row.businessAddress, legacyCtx, dek),
					await reencrypt(row.resendApiKey, legacyCtx, dek),
					await reencrypt(row.resendFromAddress, legacyCtx, dek),
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── customers ───────────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, name, email, address FROM customers WHERE userId = ?")
			.bind(userId)
			.all<{ id: string; name: string; email: string; address: string | null }>();
		for (const row of results) {
			await db
				.prepare("UPDATE customers SET name = ?, email = ?, address = ? WHERE id = ? AND userId = ?")
				.bind(
					await reencrypt(row.name, legacyCtx, dek),
					await reencrypt(row.email, legacyCtx, dek),
					await reencrypt(row.address, legacyCtx, dek),
					row.id,
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── customer_events ─────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, payload FROM customer_events WHERE userId = ? AND payload IS NOT NULL")
			.bind(userId)
			.all<{ id: string; payload: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE customer_events SET payload = ? WHERE id = ? AND userId = ?")
				.bind(await reencrypt(row.payload, legacyCtx, dek), row.id, userId)
				.run();
			rowsMigrated++;
		}
	}

	// ── projects ────────────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, rate_in_cents, description FROM projects WHERE userId = ?")
			.bind(userId)
			.all<{ id: string; rate_in_cents: string; description: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE projects SET rate_in_cents = ?, description = ? WHERE id = ? AND userId = ?")
				.bind(
					await reencrypt(row.rate_in_cents, legacyCtx, dek),
					await reencrypt(row.description, legacyCtx, dek),
					row.id,
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── timesheets ──────────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, description FROM timesheets WHERE userId = ? AND description IS NOT NULL")
			.bind(userId)
			.all<{ id: string; description: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE timesheets SET description = ? WHERE id = ? AND userId = ?")
				.bind(await reencrypt(row.description, legacyCtx, dek), row.id, userId)
				.run();
			rowsMigrated++;
		}
	}

	// ── timesheet_entries ───────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, description, amount FROM timesheet_entries WHERE userId = ?")
			.bind(userId)
			.all<{ id: string; description: string; amount: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE timesheet_entries SET description = ?, amount = ? WHERE id = ? AND userId = ?")
				.bind(
					await reencrypt(row.description, legacyCtx, dek),
					await reencrypt(row.amount, legacyCtx, dek),
					row.id,
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── transactions ────────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, description, amount FROM transactions WHERE userId = ?")
			.bind(userId)
			.all<{ id: string; description: string; amount: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE transactions SET description = ?, amount = ? WHERE id = ? AND userId = ?")
				.bind(
					await reencrypt(row.description, legacyCtx, dek),
					await reencrypt(row.amount, legacyCtx, dek),
					row.id,
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── attachments (originalName only — file bodies are re-encrypted below) ─
	{
		const { results } = await db
			.prepare("SELECT id, originalName FROM attachments WHERE userId = ?")
			.bind(userId)
			.all<{ id: string; originalName: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE attachments SET originalName = ? WHERE id = ? AND userId = ?")
				.bind(await reencrypt(row.originalName, legacyCtx, dek), row.id, userId)
				.run();
			rowsMigrated++;
		}
	}

	// ── invoices ────────────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare(
				`SELECT id, amount_cents, description, snapshot
				 FROM invoices WHERE userId = ?`,
			)
			.bind(userId)
			.all<{ id: string; amount_cents: string; description: string | null; snapshot: string | null }>();
		for (const row of results) {
			await db
				.prepare("UPDATE invoices SET amount_cents = ?, description = ?, snapshot = ? WHERE id = ? AND userId = ?")
				.bind(
					await reencrypt(row.amount_cents, legacyCtx, dek),
					await reencrypt(row.description, legacyCtx, dek),
					await reencrypt(row.snapshot, legacyCtx, dek),
					row.id,
					userId,
				)
				.run();
			rowsMigrated++;
		}
	}

	// ── invoice_events ──────────────────────────────────────────────────────
	{
		const { results } = await db
			.prepare("SELECT id, payload FROM invoice_events WHERE userId = ? AND payload IS NOT NULL")
			.bind(userId)
			.all<{ id: string; payload: string }>();
		for (const row of results) {
			await db
				.prepare("UPDATE invoice_events SET payload = ? WHERE id = ? AND userId = ?")
				.bind(await reencrypt(row.payload, legacyCtx, dek), row.id, userId)
				.run();
			rowsMigrated++;
		}
	}

	// ── R2 file bodies ──────────────────────────────────────────────────────
	// Re-encrypt file bytes: decrypt under legacy key, re-encrypt under DEK.
	// Only processes files whose attachments row belongs to this user.
	let filesMigrated = 0;
	{
		const { results } = await db
			.prepare("SELECT id FROM attachments WHERE userId = ?")
			.bind(userId)
			.all<{ id: string }>();
		for (const { id } of results) {
			const object = await c.env.FILES_BUCKET.get(id);
			if (!object) continue;
			const encryptedBytes = await object.arrayBuffer();
			// decryptBuffer passes through buffers when encryption is disabled
			// (no key). If the buffer fails to decrypt it throws — we skip.
			let plainBytes: ArrayBuffer;
			try {
				plainBytes = await decryptBuffer(encryptedBytes, legacyCtx);
			} catch {
				// Already migrated or corrupt — skip silently.
				continue;
			}
			const reEncrypted = await encryptBuffer(plainBytes, dek);
			await c.env.FILES_BUCKET.put(id, reEncrypted, {
				httpMetadata: object.httpMetadata,
				customMetadata: object.customMetadata,
			});
			filesMigrated++;
		}
	}

	return c.json({ ok: true, rowsMigrated, filesMigrated });
});

export { app as dekMigrationRoutes };
