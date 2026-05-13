/**
 * Thin wrapper around the Resend HTTP API.
 *
 * Avoids the SDK so we keep the Worker bundle small and stay portable.
 * Never logs the request body or the Authorization header — invoice content
 * is PII and the API key is a secret.
 */

export type ResendSendInput = {
	from: string;
	to: string;
	subject: string;
	html: string;
	replyTo?: string;
	// Resend API key. Callers resolve which key to use (per-user BYO or the
	// shared env key) and pass it explicitly so this wrapper doesn't reach
	// into env on its own.
	apiKey: string;
};

export class ResendError extends Error {
	readonly code: "domain_not_verified" | "api_key_missing" | "unknown";
	readonly status: number;

	constructor(code: ResendError["code"], status: number, message: string) {
		super(message);
		this.name = "ResendError";
		this.code = code;
		this.status = status;
	}
}

export const sendEmail = async (
	input: ResendSendInput,
): Promise<{ id: string }> => {
	if (!input.apiKey) {
		throw new ResendError(
			"api_key_missing",
			500,
			"Resend API key is not configured",
		);
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: input.from,
			to: [input.to],
			subject: input.subject,
			html: input.html,
			reply_to: input.replyTo,
		}),
	});

	if (!response.ok) {
		// Parse the error body without ever surfacing the auth header.
		let parsed: { name?: string; message?: string } = {};
		try {
			parsed = (await response.json()) as typeof parsed;
		} catch {
			// non-JSON error response; fall through with empty parsed
		}
		const isDomainError =
			parsed.name === "validation_error" &&
			typeof parsed.message === "string" &&
			/domain.*not.*verified|not verified|domain/i.test(parsed.message);
		const code: ResendError["code"] = isDomainError
			? "domain_not_verified"
			: "unknown";
		console.error("Resend send failed", {
			status: response.status,
			code,
			resendError: parsed.name,
		});
		throw new ResendError(
			code,
			response.status,
			parsed.message || `Resend returned ${response.status}`,
		);
	}

	const data = (await response.json()) as { id: string };
	return { id: data.id };
};
