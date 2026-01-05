import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export const getDb = async (): Promise<Database> => {
	if (!dbPromise) {
		dbPromise = Database.load("sqlite:paper-trail.db");
	}
	return dbPromise;
};
