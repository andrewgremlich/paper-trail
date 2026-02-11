import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	configureTursoSync,
	disableSync,
	getSyncConfig,
	type SyncConfig,
	syncNow,
} from "@/lib/db/syncConfig";
import styles from "./styles.module.css";
import { H3, H4, P, Span } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Flex } from "@/components/layout/Flex";

export function SyncSettings() {
	const [syncUrl, setSyncUrl] = useState("");
	const [authToken, setAuthToken] = useState("");
	const [message, setMessage] = useState("");

	const { data: config, refetch: refetchConfig } = useQuery<SyncConfig>({
		queryKey: ["syncConfig"],
		queryFn: getSyncConfig,
	});

	useEffect(() => {
		if (config) {
			setSyncUrl(config.syncUrl || "");
			setAuthToken(config.authToken || "");
		}
	}, [config]);

	const configureMutation = useMutation({
		mutationFn: ({ url, token }: { url: string; token: string }) =>
			configureTursoSync(url, token),
		onSuccess: () => {
			refetchConfig();
			setMessage("Sync configured successfully!");
		},
		onError: (error) => {
			setMessage(`Error: ${error}`);
		},
	});
	const disableMutation = useMutation({
		mutationFn: disableSync,
		onSuccess: () => {
			refetchConfig();
			setMessage("Sync disabled");
		},
		onError: (error) => {
			setMessage(`Error: ${error}`);
		},
	});
	const syncMutation = useMutation({
		mutationFn: syncNow,
		onSuccess: () => {
			setMessage("Sync completed successfully!");
		},
		onError: (error) => {
			setMessage(`Error: ${error}`);
		},
	});

	if (!config) return <div>Loading...</div>;

	return (
		<div className={styles.container}>
			<H3>Turso Sync Settings</H3>

			{config.isPaidFeature && (
				<div className={styles.banner}>
					<P className={styles.bannerText}>
						Note: Sync is a paid feature. Upgrade your subscription to enable
						cloud synchronization.
					</P>
				</div>
			)}

			<P className={styles.statusText}>
				Status:{" "}
				<Span
					className={
						config.enableSync ? styles.statusEnabled : styles.statusDisabled
					}
				>
					{config.enableSync ? "Enabled" : "Disabled"}
				</Span>
			</P>

			<Input
				label="Turso Sync URL"
				id="syncUrl"
				type="text"
				value={syncUrl}
				onChange={(e) => setSyncUrl(e.target.value)}
				placeholder="Your Turso database URL (e.g., libsql://[db-name]-[org].turso.io)"
				className={styles.input}
			/>

			<Input
				label="Auth Token"
				id="authToken"
				type="password"
				value={authToken}
				onChange={(e) => setAuthToken(e.target.value)}
				placeholder="Your Turso database authentication token"
				className={styles.input}
			/>

			<Flex gap={8} className={styles.buttonGroup}>
				<Button
					onClick={() => {
						setMessage("");
						configureMutation.mutate({ url: syncUrl, token: authToken });
					}}
					disabled={!syncUrl || !authToken || configureMutation.isPending}
				>
					{configureMutation.isPending ? "Configuring..." : "Configure Sync"}
				</Button>

				{config.enableSync && (
					<>
						<Button
							variant="secondary"
							onClick={() => {
								setMessage("");
								syncMutation.mutate();
							}}
							disabled={syncMutation.isPending}
						>
							{syncMutation.isPending ? "Syncing..." : "Sync Now"}
						</Button>

						<Button
							variant="secondary"
							onClick={() => {
								setMessage("");
								disableMutation.mutate();
							}}
							disabled={disableMutation.isPending}
						>
							{disableMutation.isPending ? "Disabling..." : "Disable Sync"}
						</Button>
					</>
				)}
			</Flex>

			{message && (
				<div
					className={
						message.startsWith("Error")
							? styles.messageError
							: styles.messageSuccess
					}
				>
					{message}
				</div>
			)}

			<div>
				<H4>How to set up Turso sync:</H4>
				<ol className={styles.instructionsList}>
					<li>
						Create a Turso account at{" "}
						<a
							href="https://turso.tech"
							target="_blank"
							rel="noopener noreferrer"
							className={styles.instructionsLink}
						>
							turso.tech
						</a>
					</li>
					<li>Install Turso CLI: brew install tursodatabase/tap/turso</li>
					<li>Login: turso auth login</li>
					<li>Create database: turso db create paper-trail</li>
					<li>Get URL: turso db show paper-trail --url</li>
					<li>Create token: turso db tokens create paper-trail</li>
					<li>Paste the URL and token above and click "Configure Sync"</li>
				</ol>
			</div>
		</div>
	);
}
