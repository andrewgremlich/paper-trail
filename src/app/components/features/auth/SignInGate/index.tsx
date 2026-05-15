import { Show, SignIn, useAuth } from "@clerk/react";
import { useEffect } from "react";
import { setAuthTokenProvider } from "@/lib/db/client";
import styles from "./styles.module.css";

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
