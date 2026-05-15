/**
 * Minimal Clerk Backend API client.
 *
 * Used during first sign-in only — once we've materialised a local users
 * row keyed by `clerkUserId`, the email and display name are cached in D1
 * and we never call Clerk again for that user. This keeps the per-request
 * latency at "verify JWT" (one local crypto call) rather than "verify JWT
 * plus outbound fetch to Clerk".
 *
 * Clerk's REST API docs: https://clerk.com/docs/reference/backend-api
 */
import type { Env } from "./types";

const CLERK_API_BASE = "https://api.clerk.com/v1";

type ClerkEmailAddress = {
	id: string;
	email_address: string;
	verification?: { status?: string } | null;
};

type ClerkUserResponse = {
	id: string;
	first_name: string | null;
	last_name: string | null;
	username: string | null;
	primary_email_address_id: string | null;
	email_addresses: ClerkEmailAddress[];
};

export type ClerkUser = {
	id: string;
	email: string;
	displayName: string;
};

export class ClerkApiError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "ClerkApiError";
		this.status = status;
	}
}

const pickPrimaryEmail = (user: ClerkUserResponse): string | null => {
	if (!user.email_addresses?.length) return null;
	const primary = user.email_addresses.find(
		(e) => e.id === user.primary_email_address_id,
	);
	const candidate =
		primary ?? user.email_addresses.find((e) => e.verification?.status === "verified");
	return candidate?.email_address ?? user.email_addresses[0].email_address;
};

const buildDisplayName = (user: ClerkUserResponse, email: string): string => {
	const first = user.first_name?.trim() ?? "";
	const last = user.last_name?.trim() ?? "";
	const full = `${first} ${last}`.trim();
	if (full) return full;
	if (user.username?.trim()) return user.username.trim();
	// Fall back to local-part of email so we always store something
	// human-readable rather than the raw clerk user id.
	return email.split("@")[0];
};

/**
 * Fetches a Clerk user by id. Requires `CLERK_SECRET_KEY` to be set.
 * Throws `ClerkApiError` on non-2xx responses so callers can map to 5xx.
 */
export const fetchClerkUser = async (
	userId: string,
	env: Env,
): Promise<ClerkUser> => {
	const secret = env.CLERK_SECRET_KEY?.trim();
	if (!secret) {
		throw new ClerkApiError(
			500,
			"CLERK_SECRET_KEY is not configured — cannot fetch user metadata",
		);
	}

	const res = await fetch(`${CLERK_API_BASE}/users/${encodeURIComponent(userId)}`, {
		headers: {
			Authorization: `Bearer ${secret}`,
			Accept: "application/json",
		},
	});
	if (!res.ok) {
		throw new ClerkApiError(
			res.status,
			`Clerk users.get returned ${res.status}`,
		);
	}
	const body = (await res.json()) as ClerkUserResponse;
	const email = pickPrimaryEmail(body);
	if (!email) {
		throw new ClerkApiError(
			500,
			"Clerk user has no email address — GitHub OAuth must include the email scope",
		);
	}
	return {
		id: body.id,
		email,
		displayName: buildDisplayName(body, email),
	};
};
