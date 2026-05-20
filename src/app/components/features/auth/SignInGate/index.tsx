import { Show, SignIn, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { setAuthTokenProvider } from "@/lib/db/client";
import styles from "./styles.module.css";

const DEV_BYPASS = import.meta.env.VITE_CLERK_BYPASS === "true";

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

const DevTokenBridge = () => {
	useEffect(() => {
		setAuthTokenProvider(async () => "dev");
		return () => {
			setAuthTokenProvider(async () => null);
		};
	}, []);
	return null;
};

export const SignInGate = ({ children }: { children: React.ReactNode }) => {
	if (DEV_BYPASS) {
		return (
			<>
				<DevTokenBridge />
				{children}
			</>
		);
	}

	return (
		<>
			<Show when="signed-in">
				<TokenBridge />
				{children}
			</Show>
			<Show when="signed-out">
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
			</Show>
		</>
	);
};
