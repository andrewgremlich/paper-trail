import { appDataDir } from "@tauri-apps/api/path";
import { Stronghold } from "@tauri-apps/plugin-stronghold";
import type { Client, Store } from "@tauri-apps/plugin-stronghold";

const STORAGE_KEY = "stripe_secret_key";
const SNAPSHOT_NAME = "paper-trail.hold";
const CLIENT_NAME = "paper-trail";
const VAULT_PASSWORD = "PaperTrailVault"; // TODO: prompt user or derive securely

let strongholdInit: Promise<{ stronghold: Stronghold; store: Store }> | null = null;

async function initStronghold(): Promise<{ stronghold: Stronghold; store: Store }> {
	if (strongholdInit) return strongholdInit;

	strongholdInit = (async () => {
		const dir = await appDataDir();
		const snapshotPath = `${dir}${SNAPSHOT_NAME}`;

		const stronghold = await Stronghold.load(snapshotPath, VAULT_PASSWORD);

		let client: Client;
		try {
			client = await stronghold.loadClient(CLIENT_NAME);
		} catch {
			client = await stronghold.createClient(CLIENT_NAME);
		}

		const store = client.getStore();
		return { stronghold, store };
	})();

	return strongholdInit;
}

export async function getStripeSecretKey(): Promise<string | null> {
	try {
		const { store } = await initStronghold();
		const data = await store.get(STORAGE_KEY);
		if (!data) return null;
		return new TextDecoder().decode(data);
	} catch {
		try {
			return typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
		} catch {
			return null;
		}
	}
}

export async function setStripeSecretKey(key: string): Promise<void> {
	try {
		const { stronghold, store } = await initStronghold();
		const bytes = Array.from(new TextEncoder().encode(key));
		await store.insert(STORAGE_KEY, bytes);
		await stronghold.save();
	} catch {
		try {
			if (typeof localStorage !== "undefined") {
				localStorage.setItem(STORAGE_KEY, key);
			}
		} catch {
			// ignore write errors
		}
	}
}

