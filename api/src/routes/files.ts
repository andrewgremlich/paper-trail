import { Hono } from "hono";
import sanitize from "sanitize-filename";
import { decrypt, encrypt } from "../lib/crypto";
import { decryptBuffer, encryptBuffer } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import type { AuthVariables } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// R2 keys are UUIDv4s generated server-side. Refuse anything else so a
// caller can't probe arbitrary keys, escape with `..`, or smuggle path
// fragments past the routing layer.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// MIME types accepted for transaction attachments. Anything else is
// rejected: text/html in particular would otherwise be rendered same-
// origin when the user later opens the link, giving us stored XSS even
// after the Content-Disposition / nosniff hardening on download.
const ALLOWED_UPLOAD_TYPES = new Set([
	"image/jpeg",
	"image/jpg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/heic",
	"image/heif",
	"application/pdf",
	"text/plain",
	"text/csv",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-excel",
]);

const isValidKey = (key: string): boolean => UUID_RE.test(key);

/**
 * Returns true if the authenticated user owns this attachment. The
 * attachments table is the single authoritative source for file ownership
 * — no transaction join, no R2 metadata fallback, no in-memory map.
 */
const userOwnsAttachment = async (
	env: Env,
	userId: number,
	key: string,
): Promise<boolean> => {
	const db = getDb(env);
	const row = await db
		.prepare("SELECT 1 AS ok FROM attachments WHERE id = ? AND userId = ? LIMIT 1")
		.bind(key, userId)
		.first<{ ok: number }>();
	return !!row?.ok;
};

/**
 * Build a Content-Disposition header that downloads with the original
 * filename. Uses both `filename=` (ASCII fallback for old browsers, with
 * dangerous characters stripped) and `filename*=UTF-8''…` (RFC 5987, the
 * authoritative form for non-ASCII names in modern browsers).
 */
const contentDispositionFor = (originalName: string): string => {
	const safe = sanitize(originalName) || "download";
	const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
	const encoded = encodeURIComponent(safe);
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

// POST /api/files/upload - upload file to R2 and create a pending
// attachments row. The row is the source of truth from this point on.
app.post("/upload", async (c) => {
	const userId = c.get("userId");
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;

	if (!file) {
		return c.json({ error: "No file provided" }, 400);
	}

	if (file.size > MAX_UPLOAD_BYTES) {
		return c.json(
			{
				error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
				code: "FILE_TOO_LARGE",
			},
			413,
		);
	}

	const contentType = (file.type || "application/octet-stream").toLowerCase();
	if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
		return c.json(
			{
				error: "Unsupported file type",
				code: "UNSUPPORTED_FILE_TYPE",
				contentType,
			},
			415,
		);
	}

	const key = crypto.randomUUID();
	const fileBytes = await file.arrayBuffer();
	const encrypted = await encryptBuffer(fileBytes, c.env);
	const sanitizedName = sanitize(file.name) || "upload";

	// Insert the DB row FIRST. If the R2 put fails after this, the cron
	// sweep will clean up the pending row (no R2 object to delete, the
	// delete call is a no-op). If the R2 put succeeds and the DB insert
	// later fails, there's no row to find the object by — so order
	// matters.
	const db = getDb(c.env);
	await db
		.prepare(
			`INSERT INTO attachments (id, userId, originalName, contentType, sizeBytes)
			VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(
			key,
			userId,
			await encrypt(sanitizedName, c.env),
			contentType,
			file.size,
		)
		.run();

	await c.env.FILES_BUCKET.put(key, encrypted, {
		httpMetadata: { contentType },
		customMetadata: {
			// Kept for export/import (which reads R2 metadata directly), and
			// as a belt-and-braces ownership marker. The attachments table is
			// authoritative.
			originalName: sanitizedName,
			ownerUserId: String(userId),
		},
	});

	return c.json({ key, originalName: sanitizedName }, 201);
});

// GET /api/files/check-link?path=:path - check if an R2 key is reachable.
//
// External URL probing was removed: it was an SSRF primitive that let any
// authenticated user have the Worker fetch arbitrary URLs. Frontend
// callers should treat http(s) `filePath` values as opaque links and let
// the browser do reachability when the user clicks through.
app.get("/check-link", async (c) => {
	const userId = c.get("userId");
	const path = c.req.query("path");
	if (!path) return c.json({ ok: false });

	if (/^https?:\/\//i.test(path)) {
		// We don't probe external URLs server-side anymore — see SSRF note above.
		return c.json({ ok: true, external: true });
	}

	if (!isValidKey(path)) return c.json({ ok: false });
	if (!(await userOwnsAttachment(c.env, userId, path))) {
		return c.json({ ok: false });
	}

	const object = await c.env.FILES_BUCKET.head(path);
	return c.json({ ok: object !== null });
});

// GET /api/files/:key - download/serve file from R2 with the original
// filename in Content-Disposition.
app.get("/:key{.+}", async (c) => {
	const userId = c.get("userId");
	const key = c.req.param("key");

	if (!isValidKey(key)) {
		// Same 404 we'd return for a truly missing object so the route
		// doesn't disclose key existence.
		return c.json({ error: "File not found" }, 404);
	}

	const db = getDb(c.env);
	const row = await db
		.prepare(
			"SELECT originalName, contentType FROM attachments WHERE id = ? AND userId = ?",
		)
		.bind(key, userId)
		.first<{ originalName: string; contentType: string }>();

	if (!row) {
		return c.json({ error: "File not found" }, 404);
	}

	const object = await c.env.FILES_BUCKET.get(key);
	if (!object) {
		// DB row exists but R2 object is gone — should not happen in normal
		// operation. The cron will reconcile by deleting the dangling row
		// on its next pass.
		return c.json({ error: "File not found" }, 404);
	}

	const originalName = await decrypt(row.originalName, c.env);

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("Content-Type", row.contentType);
	// Force download — uploaded files are user content of unknown type, so
	// don't let the browser render them inline on our origin (which would
	// be stored-XSS against the operator for an uploaded text/html file).
	headers.set("Content-Disposition", contentDispositionFor(originalName));
	headers.set("X-Content-Type-Options", "nosniff");

	const encryptedBytes = await object.arrayBuffer();
	const decrypted = await decryptBuffer(encryptedBytes, c.env);

	return new Response(decrypted, { headers });
});

// DELETE /api/files/:key - delete file from R2 and the attachments row.
//
// If the attachment is currently linked to a transaction, the link is
// cleared on the transaction first (filePath = NULL) so the user-facing
// view doesn't dangle.
app.delete("/:key{.+}", async (c) => {
	const userId = c.get("userId");
	const key = c.req.param("key");

	if (!isValidKey(key)) {
		return c.json({ error: "File not found" }, 404);
	}

	const db = getDb(c.env);

	const row = await db
		.prepare("SELECT txId FROM attachments WHERE id = ? AND userId = ?")
		.bind(key, userId)
		.first<{ txId: string | null }>();

	if (!row) {
		return c.json({ error: "File not found" }, 404);
	}

	if (row.txId) {
		await db
			.prepare(
				"UPDATE transactions SET filePath = NULL WHERE id = ? AND userId = ?",
			)
			.bind(row.txId, userId)
			.run();
	}

	await db
		.prepare("DELETE FROM attachments WHERE id = ? AND userId = ?")
		.bind(key, userId)
		.run();

	await c.env.FILES_BUCKET.delete(key);
	return c.json({ success: true });
});

export { app as fileRoutes };
