import { getDb } from "./client";

export interface SyncConfig {
	syncUrl: string | null;
	authToken: string | null;
	enableSync: boolean;
	isPaidFeature: boolean; // Future: gate sync behind paid tier
}

const SYNC_CONFIG_KEY = "paper-trail-sync-config";

/**
 * Get sync configuration from localStorage
 * Future: This will check user's subscription status to enable/disable sync
 */
export const getSyncConfig = (): SyncConfig => {
	const stored = localStorage.getItem(SYNC_CONFIG_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch {
			// Fall through to default
		}
	}

	return {
		syncUrl: null,
		authToken: null,
		enableSync: true,
		isPaidFeature: false, // TODO: Set to true when implementing paid tiers
	};
};

/**
 * Save sync configuration to localStorage
 */
export const setSyncConfig = async (config: SyncConfig): Promise<void> => {
	localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));

	// Update backend sync configuration
	const db = await getDb();
	await db.updateSyncConfig(
		config.syncUrl,
		config.authToken,
		config.enableSync,
	);
};

/**
 * Manually trigger a database sync
 * Future: This will be a paid feature
 */
export const syncNow = async (): Promise<void> => {
	const config = getSyncConfig();

	if (!config.enableSync) {
		throw new Error("Sync is disabled");
	}

	// TODO: Check if user has paid subscription before allowing sync
	// if (config.isPaidFeature && !userHasPaidSubscription()) {
	//   throw new Error("Sync is a paid feature. Please upgrade your subscription.");
	// }

	const db = await getDb();
	await db.sync();
};

/**
 * Configure Turso sync settings
 * Future: This will require a paid subscription
 */
export const configureTursoSync = async (
	syncUrl: string,
	authToken: string,
): Promise<void> => {
	const config = getSyncConfig();

	// TODO: Check if user has paid subscription
	// if (config.isPaidFeature && !userHasPaidSubscription()) {
	//   throw new Error("Sync is a paid feature. Please upgrade your subscription.");
	// }

	await setSyncConfig({
		...config,
		syncUrl,
		authToken,
		enableSync: true,
	});
};

/**
 * Disable sync
 */
export const disableSync = async (): Promise<void> => {
	const config = getSyncConfig();
	await setSyncConfig({
		...config,
		enableSync: false,
	});
};

/**
 * Enable automatic background sync
 * Sets up periodic syncing based on interval
 */
export const startAutoSync = (intervalMinutes: number = 5): (() => void) => {
	const intervalId = setInterval(
		async () => {
			try {
				const config = getSyncConfig();
				if (config.enableSync && config.syncUrl && config.authToken) {
					await syncNow();
					console.log("Auto-sync completed successfully");
				}
			} catch (error) {
				console.error("Auto-sync failed:", error);
			}
		},
		intervalMinutes * 60 * 1000,
	);

	// Return cleanup function
	return () => clearInterval(intervalId);
};
