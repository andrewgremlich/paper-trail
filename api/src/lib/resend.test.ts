import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendError, sendEmail } from "./resend";

const okJson = (body: object): Response =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});

const errJson = (status: number, body: object): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const baseInput = () => ({
	from: "Acme <invoices@example.com>",
	to: "buyer@example.com",
	subject: "Invoice INV-001",
	html: "<p>hello</p>",
	apiKey: "re_test_123",
});

describe("sendEmail", () => {
	const origFetch = globalThis.fetch;

	beforeEach(() => {
		// suppress the console.error from error paths
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		globalThis.fetch = origFetch;
		vi.restoreAllMocks();
	});

	it("throws api_key_missing without calling fetch when apiKey is empty", async () => {
		const fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await expect(
			sendEmail({ ...baseInput(), apiKey: "" }),
		).rejects.toMatchObject({
			name: "ResendError",
			code: "api_key_missing",
			status: 500,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns the message id on a 200 response", async () => {
		const fetchMock = vi.fn().mockResolvedValue(okJson({ id: "msg_abc" }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await sendEmail(baseInput());
		expect(result).toEqual({ id: "msg_abc" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("POSTs to the correct Resend URL with bearer + JSON content-type", async () => {
		let captured: { url?: string; init?: RequestInit } = {};
		const fetchMock = vi.fn((url: string, init: RequestInit) => {
			captured = { url, init };
			return Promise.resolve(okJson({ id: "x" }));
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await sendEmail(baseInput());

		expect(captured.url).toBe("https://api.resend.com/emails");
		expect(captured.init?.method).toBe("POST");
		const headers = captured.init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer re_test_123");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("wraps to in an array and snake-cases reply_to", async () => {
		let bodyJson: { to?: string[]; reply_to?: string } = {};
		const fetchMock = vi.fn((_url: string, init: RequestInit) => {
			bodyJson = JSON.parse(init.body as string);
			return Promise.resolve(okJson({ id: "x" }));
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await sendEmail({ ...baseInput(), replyTo: "reply@example.com" });

		expect(bodyJson.to).toEqual(["buyer@example.com"]);
		expect(bodyJson.reply_to).toBe("reply@example.com");
	});

	it("maps a 'domain not verified' validation_error to domain_not_verified", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			errJson(403, {
				name: "validation_error",
				message: "The domain is not verified.",
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await expect(sendEmail(baseInput())).rejects.toMatchObject({
			name: "ResendError",
			code: "domain_not_verified",
			status: 403,
		});
	});

	it("falls back to 'unknown' for other validation errors", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			errJson(422, {
				name: "validation_error",
				message: "from address required",
			}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await expect(sendEmail(baseInput())).rejects.toMatchObject({
			name: "ResendError",
			code: "unknown",
			status: 422,
		});
	});

	it("handles non-JSON error bodies without throwing during parse", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response("Internal Server Error", { status: 500 }),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await expect(sendEmail(baseInput())).rejects.toMatchObject({
			name: "ResendError",
			code: "unknown",
			status: 500,
		});
	});

	it("never logs or surfaces the API key in error messages", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				errJson(500, { name: "internal_error", message: "boom" }),
			);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			await sendEmail(baseInput());
		} catch (e) {
			const err = e as ResendError;
			expect(err.message).not.toContain("re_test_123");
		}

		for (const call of errorSpy.mock.calls) {
			expect(JSON.stringify(call)).not.toContain("re_test_123");
		}
	});

	it("ResendError carries name, code, and status", () => {
		const e = new ResendError("unknown", 500, "boom");
		expect(e).toBeInstanceOf(Error);
		expect(e.name).toBe("ResendError");
		expect(e.code).toBe("unknown");
		expect(e.status).toBe(500);
		expect(e.message).toBe("boom");
	});
});
