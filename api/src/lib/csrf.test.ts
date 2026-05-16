// @vitest-environment node
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
	CSRF_FIELD,
	csrfFormField,
	issueCsrfToken,
	validateCsrfToken,
} from "./csrf";

const cookieFor = (scope: "consent" | "revoke") =>
	scope === "revoke" ? "pt_revoke_csrf" : "pt_consent_csrf";

// Round-trip helper: hit a GET handler that issues a token via Set-Cookie,
// extract both the nonce and the cookie value, then call back into a POST
// handler that validates the cookie+form pair.
const runIssueAndValidate = async (opts: {
	scope: "consent" | "revoke";
	formValue: string | undefined;
	cookieOverride?: string | "delete";
}): Promise<boolean> => {
	const app = new Hono();
	let issuedNonce = "";
	app.get("/issue", (c) => {
		issuedNonce = issueCsrfToken(c, opts.scope);
		return c.text("ok");
	});

	const issueRes = await app.request("http://localhost/issue");
	const setCookie = issueRes.headers.get("Set-Cookie") ?? "";

	// SameSite=Strict + Secure should be present
	expect(setCookie).toMatch(/SameSite=Strict/i);
	expect(setCookie).toMatch(/HttpOnly/i);
	expect(setCookie).toMatch(/Secure/i);

	// Path matches the scope
	const expectedPath = opts.scope === "revoke" ? "/consent/revoke" : "/consent";
	expect(setCookie).toContain(`Path=${expectedPath}`);

	// Parse just the cookie key=value pair (first segment before ";")
	const firstPair = setCookie.split(";")[0];
	const cookieName = cookieFor(opts.scope);
	expect(firstPair.startsWith(`${cookieName}=`)).toBe(true);
	const cookieValue = firstPair.slice(cookieName.length + 1);

	// Sanity: returned nonce equals the cookie value
	expect(cookieValue).toBe(issuedNonce);

	// Now drive a validate call
	let result = false;
	const app2 = new Hono();
	app2.post("/validate", async (c) => {
		const body = await c.req.parseBody();
		result = validateCsrfToken(c, opts.scope, body[CSRF_FIELD]);
		return c.text("ok");
	});

	const form = new FormData();
	if (opts.formValue !== undefined) {
		form.set(CSRF_FIELD, opts.formValue);
	}

	const headers: HeadersInit = {};
	if (opts.cookieOverride === "delete") {
		// no Cookie header
	} else if (opts.cookieOverride !== undefined) {
		headers.Cookie = `${cookieName}=${opts.cookieOverride}`;
	} else {
		headers.Cookie = `${cookieName}=${cookieValue}`;
	}

	await app2.request("http://localhost/validate", {
		method: "POST",
		headers,
		body: form,
	});
	return result;
};

describe("issueCsrfToken", () => {
	it("returns a 64-char hex nonce", async () => {
		const app = new Hono();
		let nonce = "";
		app.get("/", (c) => {
			nonce = issueCsrfToken(c, "consent");
			return c.text("ok");
		});
		await app.request("http://localhost/");
		expect(nonce).toMatch(/^[0-9a-f]{64}$/);
	});

	it("uses a different cookie name + path for the revoke scope", async () => {
		const app = new Hono();
		app.get("/", (c) => {
			issueCsrfToken(c, "revoke");
			return c.text("ok");
		});
		const res = await app.request("http://localhost/");
		const sc = res.headers.get("Set-Cookie") ?? "";
		expect(sc).toContain("pt_revoke_csrf=");
		expect(sc).toContain("Path=/consent/revoke");
		expect(sc).not.toContain("pt_consent_csrf=");
	});
});

describe("csrfFormField", () => {
	it("emits a hidden input with the field name + nonce", () => {
		expect(csrfFormField("deadbeef")).toBe(
			`<input type="hidden" name="${CSRF_FIELD}" value="deadbeef" />`,
		);
	});
});

describe("validateCsrfToken", () => {
	it("accepts a matching cookie + form value", async () => {
		const app = new Hono();
		let nonce = "";
		app.get("/i", (c) => {
			nonce = issueCsrfToken(c, "consent");
			return c.text("ok");
		});
		const issueRes = await app.request("http://localhost/i");
		const setCookie = issueRes.headers.get("Set-Cookie") ?? "";
		const cookieVal = setCookie.split(";")[0].split("=")[1];

		const app2 = new Hono();
		let result = false;
		app2.post("/v", async (c) => {
			const body = await c.req.parseBody();
			result = validateCsrfToken(c, "consent", body[CSRF_FIELD]);
			return c.text("ok");
		});
		const fd = new FormData();
		fd.set(CSRF_FIELD, nonce);
		await app2.request("http://localhost/v", {
			method: "POST",
			headers: { Cookie: `pt_consent_csrf=${cookieVal}` },
			body: fd,
		});
		expect(result).toBe(true);
	});

	it("rejects when cookie is absent", async () => {
		const result = await runIssueAndValidate({
			scope: "consent",
			formValue: "anything",
			cookieOverride: "delete",
		});
		expect(result).toBe(false);
	});

	it("rejects when form value is absent", async () => {
		const result = await runIssueAndValidate({
			scope: "consent",
			formValue: undefined,
		});
		expect(result).toBe(false);
	});

	it("rejects when form value does not match the cookie", async () => {
		const result = await runIssueAndValidate({
			scope: "consent",
			formValue: "not-the-nonce",
		});
		expect(result).toBe(false);
	});

	it("rejects when form value is empty string", async () => {
		const result = await runIssueAndValidate({
			scope: "consent",
			formValue: "",
		});
		expect(result).toBe(false);
	});

	it("uses the per-scope cookie — revoke cookie does not satisfy consent scope", async () => {
		// Issue a revoke token, then submit it as the consent form
		const app = new Hono();
		let nonce = "";
		app.get("/", (c) => {
			nonce = issueCsrfToken(c, "revoke");
			return c.text("ok");
		});
		const res = await app.request("http://localhost/");
		const sc = res.headers.get("Set-Cookie") ?? "";
		const cookieVal = sc.split(";")[0].split("=")[1];

		const app2 = new Hono();
		let result = false;
		app2.post("/v", async (c) => {
			const body = await c.req.parseBody();
			// Validate as consent — the cookie is named pt_revoke_csrf, so the
			// consent-scope validator should not find it.
			result = validateCsrfToken(c, "consent", body[CSRF_FIELD]);
			return c.text("ok");
		});
		const fd = new FormData();
		fd.set(CSRF_FIELD, nonce);
		await app2.request("http://localhost/v", {
			method: "POST",
			headers: { Cookie: `pt_revoke_csrf=${cookieVal}` },
			body: fd,
		});
		expect(result).toBe(false);
	});
});
