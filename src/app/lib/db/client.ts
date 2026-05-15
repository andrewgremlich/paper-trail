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

/**
 * Auth token provider. Set during app bootstrap from a `useAuth()` hook in
 * the React tree so this non-React module can still attach a fresh
 * `Authorization: Bearer <token>` header on every API call. We deliberately
 * fetch the token at call time (not at module load) because Clerk session
 * tokens are short-lived and rotate.
 */
type TokenProvider = () => Promise<string | null>;
let getAuthToken: TokenProvider = async () => null;

export const setAuthTokenProvider = (provider: TokenProvider) => {
	getAuthToken = provider;
};

const authHeaders = async (
	existing?: HeadersInit,
): Promise<Record<string, string>> => {
	const merged: Record<string, string> = {};
	if (existing) {
		const h = new Headers(existing);
		h.forEach((value, key) => {
			merged[key] = value;
		});
	}
	const token = await getAuthToken();
	if (token) {
		merged.Authorization = `Bearer ${token}`;
	}
	return merged;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const headers = await authHeaders({
		"Content-Type": "application/json",
		...options?.headers,
	});
	const res = await fetch(`${API_BASE}${path}`, {
		credentials: "include",
		...options,
		headers,
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
		const headers = await authHeaders();
		// Do NOT set Content-Type; the browser computes the multipart
		// boundary automatically.
		const res = await fetch(`${API_BASE}${path}`, {
			method: "POST",
			credentials: "include",
			headers,
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
	getRaw: async (path: string) => {
		const headers = await authHeaders();
		return fetch(`${API_BASE}${path}`, {
			credentials: "include",
			headers,
		});
	},
};
