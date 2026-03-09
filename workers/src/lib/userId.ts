import type { Client } from "@libsql/client";
import type { UserProfile } from "./types";

export async function getCurrentUserId(db: Client): Promise<number> {
	const result = await db.execute(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);

	if (result.rows.length > 0) {
		return result.rows[0].id as number;
	}

	const uuid = crypto.randomUUID();
	await db.execute({
		sql: "INSERT INTO user_profile (uuid) VALUES (?)",
		args: [uuid],
	});

	const created = await db.execute("SELECT id FROM user_profile LIMIT 1");
	return created.rows[0].id as number;
}

export async function getUserProfile(db: Client): Promise<UserProfile> {
	const result = await db.execute(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);

	if (result.rows.length > 0) {
		const row = result.rows[0];
		return {
			id: row.id as number,
			uuid: row.uuid as string,
			displayName: (row.displayName as string) ?? "",
			email: (row.email as string) ?? "",
			createdAt: row.createdAt as string,
			updatedAt: row.updatedAt as string,
		};
	}

	const uuid = crypto.randomUUID();
	await db.execute({
		sql: "INSERT INTO user_profile (uuid) VALUES (?)",
		args: [uuid],
	});

	const created = await db.execute(
		"SELECT id, uuid, displayName, email, createdAt, updatedAt FROM user_profile LIMIT 1",
	);
	const row = created.rows[0];
	return {
		id: row.id as number,
		uuid: row.uuid as string,
		displayName: (row.displayName as string) ?? "",
		email: (row.email as string) ?? "",
		createdAt: row.createdAt as string,
		updatedAt: row.updatedAt as string,
	};
}
