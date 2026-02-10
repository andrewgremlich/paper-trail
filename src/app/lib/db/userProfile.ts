import { getDb } from "./client";
import { configureTursoSync, getSyncConfig, syncNow } from "./syncConfig";
import type { SyncCode, UpdateUserProfile, UserProfile } from "./types";

const uint8ToBase64 = (bytes: Uint8Array): string =>
	btoa(String.fromCodePoint(...bytes));

const base64ToUint8 = (str: string): Uint8Array =>
	Uint8Array.from(atob(str), (c) => c.codePointAt(0) ?? 0);

let cachedUserId: number | null = null;

export const getCurrentUserId = async (): Promise<number> => {
	if (cachedUserId !== null) return cachedUserId;
	const profile = await getUserProfile();
	cachedUserId = profile.id;
	return cachedUserId;
};

export const getUserProfile = async (): Promise<UserProfile> => {
	const db = await getDb();
	const rows = await db.select<UserProfile[]>(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);

	if (rows.length > 0) {
		return rows[0];
	}

	const uuid = crypto.randomUUID();
	await db.execute("INSERT INTO user_profile (uuid) VALUES ($1)", [uuid]);

	const created = await db.select<UserProfile[]>(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);
	return created[0];
};

export const updateUserProfile = async (
	profile: UpdateUserProfile,
): Promise<UserProfile | null> => {
	const db = await getDb();
	const existing = await getUserProfile();

	await db.execute(
		"UPDATE user_profile SET displayName = $1, email = $2 WHERE id = $3",
		[profile.displayName, profile.email, existing.id],
	);

	const updated = await db.select<UserProfile[]>(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile WHERE id = $1",
		[existing.id],
	);
	return updated[0] ?? null;
};

export const generateSyncCode = async (): Promise<string> => {
	const profile = await getUserProfile();
	const syncConfig = getSyncConfig();

	if (!syncConfig.syncUrl || !syncConfig.authToken) {
		throw new Error(
			"Sync is not configured. Set up Turso sync before generating a sync code.",
		);
	}

	const payload: SyncCode = {
		uuid: profile.uuid,
		syncUrl: syncConfig.syncUrl,
		authToken: syncConfig.authToken,
	};

	const encoded = new TextEncoder().encode(JSON.stringify(payload));
	return uint8ToBase64(encoded);
};

export const applySyncCode = async (code: string): Promise<void> => {
	const decoded = JSON.parse(
		new TextDecoder().decode(base64ToUint8(code)),
	) as SyncCode;

	if (!decoded.uuid || !decoded.syncUrl || !decoded.authToken) {
		throw new Error("Invalid sync code.");
	}

	const db = await getDb();
	const existing = await getUserProfile();

	await db.execute("UPDATE user_profile SET uuid = $1 WHERE id = $2", [
		decoded.uuid,
		existing.id,
	]);

	await configureTursoSync(decoded.syncUrl, decoded.authToken);
	await syncNow();
};
