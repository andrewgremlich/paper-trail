const API_BASE = "/api/v1";

export class ApiError extends Error {
	readonly status: number;
	readonly code: string | undefined;
	readonly body: unknown;
	constructor(status: number, body: unknown) {
		const code =
			body && typeof body === "object" && "code" in body
				? String((body as { code: unknown }).code)
				: undefined;
		const errorMsg =
			body && typeof body === "object" && "error" in body
				? String((body as { error: unknown }).error)
				: `HTTP ${status}`;
		super(errorMsg);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.body = body;
	}
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		...options,
	});

	if (!res.ok) {
		let body: unknown;
		const text = await res.text();
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
		throw new ApiError(res.status, body);
	}

	return res.json();
}

export const api = {
	get: <T>(path: string) => apiFetch<T>(path),
	post: <T>(path: string, body?: unknown) =>
		apiFetch<T>(path, {
			method: "POST",
			body: body !== undefined ? JSON.stringify(body) : undefined,
		}),
	put: <T>(path: string, body: unknown) =>
		apiFetch<T>(path, {
			method: "PUT",
			body: JSON.stringify(body),
		}),
	delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
	postFormData: async <T>(path: string, formData: FormData): Promise<T> => {
		const res = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			credentials: "include",
			body: formData,
		});
		if (!res.ok) {
			let body: unknown;
			const text = await res.text();
			try {
				body = JSON.parse(text);
			} catch {
				body = text;
			}
			throw new ApiError(res.status, body);
		}
		return res.json();
	},
	getRaw: (path: string) =>
		fetch(`${API_BASE}${path}`, { credentials: "include" }),
};
