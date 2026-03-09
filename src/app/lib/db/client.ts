const API_BASE = "/api";

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
		const body = await res.text();
		throw new Error(`API error ${res.status}: ${body}`);
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
			const body = await res.text();
			throw new Error(`API error ${res.status}: ${body}`);
		}
		return res.json();
	},
	getRaw: (path: string) =>
		fetch(`${API_BASE}${path}`, { credentials: "include" }),
};
