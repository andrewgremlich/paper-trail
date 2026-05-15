import { SignedIn, SignedOut, SignIn, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { setAuthTokenProvider } from "@/lib/db/client";
import styles from "./styles.module.css";

/**
 * Wraps the authenticated app. While signed out we render the Clerk
 * `<SignIn />` widget (which exposes GitHub OAuth and any other connectors
 * enabled on the Clerk instance). While signed in we install a
 * token-getter into the non-React `api` client so every backend fetch
 * carries a fresh `Authorization: Bearer <token>` header.
 *
 * Clerk's `<SignIn />` is rendered standalone (no `path` prop) — it works
 * as an in-page card and avoids us having to add a router just for the
 * sign-in route.
 */
const TokenBridge = () => {
	const { getToken } = useAuth();
	useEffect(() => {
		setAuthTokenProvider(() => getToken());
		return () => {
			setAuthTokenProvider(async () => null);
		};
	}, [getToken]);
	return null;
};

export const SignInGate = ({ children }: { children: React.ReactNode }) => (
	<>
		<SignedIn>
			<TokenBridge />
			{children}
		</SignedIn>
		<SignedOut>
			<div className={styles.gate}>
				<div className={styles.intro}>
					<h1 className={styles.title}>Paper Trail</h1>
					<p className={styles.subtitle}>
						Sign in to manage your timesheets, invoices, and customers.
					</p>
				</div>
				<SignIn
					routing="hash"
					appearance={{
						elements: {
							rootBox: styles.signInRoot,
						},
					}}
				/>
			</div>
		</SignedOut>
	</>
);
