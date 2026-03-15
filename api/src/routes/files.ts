import { Hono } from "hono";
import type { Env } from "../lib/types";

const app = new Hono<{ Bindings: Env }>();

// POST /api/files/upload - upload file to R2
app.post("/upload", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File | null;
	const projectName = formData.get("projectName") as string | null;

	if (!file) {
		return c.json({ error: "No file provided" }, 400);
	}

	const sanitizedProject = (projectName ?? "default").replace(
		/[^a-zA-Z0-9-_]/g,
		"-",
	);
	const key = `${sanitizedProject}/attachments/${crypto.randomUUID()}-${file.name}`;

	console.log(`Uploading file to R2 with key: ${key}`);

	await c.env.FILES_BUCKET.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	return c.json({ key }, 201);
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

	return new Response(object.body, { headers });
});

// DELETE /api/files/:key+ - delete file from R2
app.delete("/:key{.+}", async (c) => {
	const key = c.req.param("key");
	await c.env.FILES_BUCKET.delete(key);
	return c.json({ success: true });
});

export { app as fileRoutes };
