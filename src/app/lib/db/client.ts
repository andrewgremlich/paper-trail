import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export const getDb = async (): Promise<Database> => {
	if (!dbPromise) {
		// Uses app data dir by default; Tauri SQL plugin resolves this DSN.
		dbPromise = Database.load("sqlite:paper-trail.db");
	}
	return dbPromise;
};
