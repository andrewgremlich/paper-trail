import { invoke } from "@tauri-apps/api/core";

interface ExecuteResult {
	rows_affected: number;
	last_insert_id: number;
}

class TursoDatabase {
	async select<T>(query: string, params: unknown[] = []): Promise<T> {
		const result = await invoke<T>("execute_query", {
			query,
			params,
		});
		return result;
	}

	async execute(
		query: string,
		params: unknown[] = [],
	): Promise<{ lastInsertId: number; rowsAffected: number }> {
		const result = await invoke<ExecuteResult>("execute_statement", {
			query,
			params,
		});
		return {
			lastInsertId: result.last_insert_id,
			rowsAffected: result.rows_affected,
		};
	}

	async sync(): Promise<void> {
		await invoke("sync_database");
	}

	async updateSyncConfig(
		syncUrl: string | null,
		authToken: string | null,
		enableSync: boolean,
	): Promise<void> {
		await invoke("update_sync_config", {
			syncUrl,
			authToken,
			enableSync,
		});
	}
}

let dbInstance: TursoDatabase | null = null;

export const getDb = async (): Promise<TursoDatabase> => {
	if (!dbInstance) {
		dbInstance = new TursoDatabase();
	}
	return dbInstance;
};

export type Database = TursoDatabase;
