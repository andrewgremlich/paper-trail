import { Hono } from "hono";
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
 * Returns true if the authenticated user owns a transaction that points at
 * this R2 key. Files are reachable only through transaction rows — there's
 * no public-file concept — so this is the authoritative ownership check.
 */
const userOwnsKey = async (
	env: Env,
	userId: number,
	key: string,
): Promise<boolean> => {
	const db = getDb(env);
	const row = await db
		.prepare(
			"SELECT 1 AS ok FROM transactions WHERE filePath = ? AND userId = ? LIMIT 1",
		)
		.bind(key, userId)
		.first<{ ok: number }>();
	return !!row?.ok;
};

// In-flight uploads aren't yet attached to a transaction. We track them in
// a per-Worker-instance Map so a newly-uploaded key can be fetched/deleted
// by its uploader before the transaction row is written. Entries expire
// after 10 minutes — long enough to attach to a transaction, short enough
// that a forgotten upload doesn't linger as a reachable orphan.
const PENDING_UPLOAD_TTL_MS = 10 * 60 * 1000;
const pendingUploads = new Map<string, { userId: number; expiresAt: number }>();

const markPendingUpload = (key: string, userId: number): void => {
	const now = Date.now();
	pendingUploads.set(key, { userId, expiresAt: now + PENDING_UPLOAD_TTL_MS });
	// Cheap GC — purge expired entries on each insert.
	if (pendingUploads.size > 256) {
		for (const [k, v] of pendingUploads) {
			if (v.expiresAt < now) pendingUploads.delete(k);
		}
	}
};

const isPendingUploadFor = (key: string, userId: number): boolean => {
	const entry = pendingUploads.get(key);
	if (!entry) return false;
	if (entry.expiresAt < Date.now()) {
		pendingUploads.delete(key);
		return false;
	}
	return entry.userId === userId;
};

// POST /api/files/upload - upload file to R2
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

	await c.env.FILES_BUCKET.put(key, encrypted, {
		httpMetadata: { contentType: file.type },
		customMetadata: {
			originalName: file.name,
			// Stamp the uploader on the R2 object too so even if the in-memory
			// Map is lost (cold start) we can still authorise access for
			// keys that haven't been attached to a transaction yet.
			ownerUserId: String(userId),
		},
	});

	markPendingUpload(key, userId);

	return c.json({ key }, 201);
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
	if (!(await userOwnsKey(c.env, userId, path))) return c.json({ ok: false });

	const object = await c.env.FILES_BUCKET.head(path);
	return c.json({ ok: object !== null });
});

// GET /api/files/:key+ - download/serve file from R2
app.get("/:key{.+}", async (c) => {
	const userId = c.get("userId");
	const key = c.req.param("key");

	if (!isValidKey(key)) {
		return c.json({ error: "File not found" }, 404);
	}

	// Authorise: either the caller owns a transaction pointing at this
	// key, or the upload is still pending and was created by this caller.
	if (
		!isPendingUploadFor(key, userId) &&
		!(await userOwnsKey(c.env, userId, key))
	) {
		const object = await c.env.FILES_BUCKET.head(key);
		const ownerStr = object?.customMetadata?.ownerUserId;
		if (!ownerStr || Number(ownerStr) !== userId) {
			// Return the same 404 we'd return for a truly missing object so
			// the route doesn't disclose key existence.
			return c.json({ error: "File not found" }, 404);
		}
	}

	const object = await c.env.FILES_BUCKET.get(key);
	if (!object) {
		return c.json({ error: "File not found" }, 404);
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	// Force download — uploaded files are user content of unknown type, so
	// don't let the browser render them inline on our origin (which would
	// be stored-XSS against the operator for an uploaded text/html file).
	headers.set("Content-Disposition", "attachment");
	headers.set("X-Content-Type-Options", "nosniff");

	const encryptedBytes = await object.arrayBuffer();
	const decrypted = await decryptBuffer(encryptedBytes, c.env);

	return new Response(decrypted, { headers });
});

// DELETE /api/files/:key+ - delete file from R2
app.delete("/:key{.+}", async (c) => {
	const userId = c.get("userId");
	const key = c.req.param("key");

	if (!isValidKey(key)) {
		return c.json({ error: "File not found" }, 404);
	}

	// Same authorisation as GET — owners of the linked transaction, or
	// the pending uploader.
	let authorised =
		isPendingUploadFor(key, userId) || (await userOwnsKey(c.env, userId, key));
	if (!authorised) {
		const object = await c.env.FILES_BUCKET.head(key);
		const ownerStr = object?.customMetadata?.ownerUserId;
		authorised = !!ownerStr && Number(ownerStr) === userId;
	}
	if (!authorised) {
		return c.json({ error: "File not found" }, 404);
	}

	await c.env.FILES_BUCKET.delete(key);
	pendingUploads.delete(key);
	return c.json({ success: true });
});

export { app as fileRoutes };
