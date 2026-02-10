import { appDataDir } from "@tauri-apps/api/path";
import type { Client, Store } from "@tauri-apps/plugin-stronghold";
import { Stronghold } from "@tauri-apps/plugin-stronghold";

import { getPassword, setPassword } from "tauri-plugin-keyring-api";

const STORAGE_KEY = "stripe_secret_key";
const SNAPSHOT_NAME = "paper-trail.hold";
const CLIENT_NAME = "paper-trail";
const KEYRING_SERVICE = "dev.gremlich.paper-trail";
const KEYRING_ACCOUNT = "vault-password";
const LEGACY_PASSWORD = "PaperTrailVault";

async function getVaultPassword(): Promise<string> {
	const existing = await getPassword(KEYRING_SERVICE, KEYRING_ACCOUNT);
	if (existing) return existing;

	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	const password = btoa(String.fromCharCode(...randomBytes));

	await setPassword(KEYRING_SERVICE, KEYRING_ACCOUNT, password);
	return password;
}

let strongholdInit: Promise<{ stronghold: Stronghold; store: Store }> | null =
	null;

async function initStronghold(): Promise<{
	stronghold: Stronghold;
	store: Store;
}> {
	if (strongholdInit) return strongholdInit;

	strongholdInit = (async () => {
		const dir = await appDataDir();
		const snapshotPath = `${dir}${SNAPSHOT_NAME}`;
		const vaultPassword = await getVaultPassword();

		let stronghold: Stronghold;
		let migrated = false;

		try {
			stronghold = await Stronghold.load(snapshotPath, vaultPassword);
		} catch {
			// Existing snapshot may be encrypted with the legacy password
			try {
				stronghold = await Stronghold.load(snapshotPath, LEGACY_PASSWORD);
				migrated = true;
			} catch {
				// No valid snapshot exists — create fresh with new password
				stronghold = await Stronghold.load(snapshotPath, vaultPassword);
			}
		}

		let client: Client;
		try {
			client = await stronghold.loadClient(CLIENT_NAME);
		} catch {
			client = await stronghold.createClient(CLIENT_NAME);
		}

		const store = client.getStore();

		if (migrated) {
			// Re-save the snapshot so it's encrypted with the new keychain password.
			// Stronghold.save() writes with the password used at load time,
			// so we need to read data, destroy, and recreate with the new password.
			const existingKey = await store.get(STORAGE_KEY);
			await stronghold.save();

			// Reload with new password by removing and recreating
			stronghold = await Stronghold.load(snapshotPath, vaultPassword);
			try {
				client = await stronghold.loadClient(CLIENT_NAME);
			} catch {
				client = await stronghold.createClient(CLIENT_NAME);
			}
			const newStore = client.getStore();

			if (existingKey) {
				await newStore.insert(
					STORAGE_KEY,
					Array.from(new Uint8Array(existingKey)),
				);
			}
			await stronghold.save();
			return { stronghold, store: newStore };
		}

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
			return typeof localStorage !== "undefined"
				? localStorage.getItem(STORAGE_KEY)
				: null;
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
