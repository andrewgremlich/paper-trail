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

	const handleConfigureSync = () => {
		setMessage("");
		configureMutation.mutate({ url: syncUrl, token: authToken });
	};

	const handleDisableSync = () => {
		setMessage("");
		disableMutation.mutate();
	};

	const handleSyncNow = () => {
		setMessage("");
		syncMutation.mutate();
	};

	if (!config) return <div>Loading...</div>;

	return (
		<div className={styles.container}>
			<h2 className={styles.heading}>Turso Sync Settings</h2>

			{config.isPaidFeature && (
				<div className={styles.banner}>
					<p className={styles.bannerText}>
						Note: Sync is a paid feature. Upgrade your subscription to enable
						cloud synchronization.
					</p>
				</div>
			)}

			<div className={styles.statusContainer}>
				<p className={styles.statusText}>
					Status:{" "}
					<span
						className={
							config.enableSync ? styles.statusEnabled : styles.statusDisabled
						}
					>
						{config.enableSync ? "Enabled" : "Disabled"}
					</span>
				</p>
			</div>

			<div className={styles.formContainer}>
				<div className={styles.inputGroup}>
					<label className={styles.inputLabel} htmlFor="syncUrl">
						Turso Sync URL
					</label>
					<input
						id="syncUrl"
						type="text"
						value={syncUrl}
						onChange={(e) => setSyncUrl(e.target.value)}
						placeholder="libsql://your-database.turso.io"
						className={styles.input}
					/>
					<p className={styles.inputHelp}>
						Your Turso database URL (e.g., libsql://[db-name]-[org].turso.io)
					</p>
				</div>

				<div className={styles.inputGroup}>
					<label className={styles.inputLabel} htmlFor="authToken">
						Auth Token
					</label>
					<input
						id="authToken"
						type="password"
						value={authToken}
						onChange={(e) => setAuthToken(e.target.value)}
						placeholder="your-turso-auth-token"
						className={styles.input}
					/>
					<p className={styles.inputHelp}>
						Your Turso database authentication token
					</p>
				</div>

				<div className={styles.buttonGroup}>
					<button
						type="button"
						onClick={handleConfigureSync}
						disabled={!syncUrl || !authToken || configureMutation.isPending}
						className={styles.buttonPrimary}
					>
						{configureMutation.isPending ? "Configuring..." : "Configure Sync"}
					</button>

					{config.enableSync && (
						<>
							<button
								type="button"
								onClick={handleSyncNow}
								disabled={syncMutation.isPending}
								className={styles.buttonSuccess}
							>
								{syncMutation.isPending ? "Syncing..." : "Sync Now"}
							</button>

							<button
								type="button"
								onClick={handleDisableSync}
								disabled={disableMutation.isPending}
								className={styles.buttonDanger}
							>
								{disableMutation.isPending ? "Disabling..." : "Disable Sync"}
							</button>
						</>
					)}
				</div>

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
			</div>

			<div className={styles.instructionsContainer}>
				<h3 className={styles.instructionsHeading}>
					How to set up Turso sync:
				</h3>
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
