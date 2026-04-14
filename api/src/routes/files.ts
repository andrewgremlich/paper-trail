import { Hono } from "hono";
import { decryptBuffer, encryptBuffer } from "../lib/crypto";
import type { Env } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

// POST /api/files/upload - upload file to R2
app.post("/upload", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;

	if (!file) {
		return c.json({ error: "No file provided" }, 400);
	}

	const key = crypto.randomUUID();

	const fileBytes = await file.arrayBuffer();
	const encrypted = await encryptBuffer(fileBytes, c.env);

	await c.env.FILES_BUCKET.put(key, encrypted, {
		httpMetadata: { contentType: file.type },
	});

	return c.json({ key }, 201);
});

// GET /api/files/check-link?path=:path - check if an R2 key or external URL is reachable
app.get("/check-link", async (c) => {
	const path = c.req.query("path");
	if (!path) return c.json({ ok: false });

	const isUrl = /^https?:\/\//i.test(path);

	if (isUrl) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);
			const res = await fetch(path, {
				method: "HEAD",
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			return c.json({ ok: res.ok });
		} catch {
			return c.json({ ok: false });
		}
	}

	const object = await c.env.FILES_BUCKET.head(path);
	return c.json({ ok: object !== null });
});

// GET /api/files/:key+ - download/serve file from R2
app.get("/:key{.+}", async (c) => {
	const key = c.req.param("key");
	const object = await c.env.FILES_BUCKET.get(key);

	if (!object) {
		return c.json({ error: "File not found" }, 404);
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);

	const encryptedBytes = await object.arrayBuffer();
	const decrypted = await decryptBuffer(encryptedBytes, c.env);

	return new Response(decrypted, { headers });
});

// DELETE /api/files/:key+ - delete file from R2
app.delete("/:key{.+}", async (c) => {
	const key = c.req.param("key");
	await c.env.FILES_BUCKET.delete(key);
	return c.json({ success: true });
});

export { app as fileRoutes };
