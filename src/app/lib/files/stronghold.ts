// Stronghold is no longer used in the web version.
// Stripe keys are managed server-side via Cloudflare Workers secrets.
// This file is kept as a stub to avoid breaking imports during migration.

export async function getStripeSecretKey(): Promise<string | null> {
	return null;
}

export async function setStripeSecretKey(_key: string): Promise<void> {
	// No-op in web version — keys are server-side
}
