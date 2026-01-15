import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	configureTursoSync,
	disableSync,
	getSyncConfig,
	type SyncConfig,
	syncNow,
} from "@/lib/db/syncConfig";

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
		<div className="p-6 bg-white rounded-lg shadow">
			<h2 className="text-2xl font-bold mb-4">Turso Sync Settings</h2>

			{config.isPaidFeature && (
				<div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
					<p className="text-yellow-800">
						Note: Sync is a paid feature. Upgrade your subscription to enable
						cloud synchronization.
					</p>
				</div>
			)}

			<div className="mb-4">
				<p className="text-sm text-gray-600 mb-2">
					Status:{" "}
					<span
						className={`font-semibold ${config.enableSync ? "text-green-600" : "text-red-600"}`}
					>
						{config.enableSync ? "Enabled" : "Disabled"}
					</span>
				</p>
			</div>

			<div className="space-y-4">
				<div>
					<label className="block text-sm font-medium mb-1" htmlFor="syncUrl">
						Turso Sync URL
					</label>
					<input
						id="syncUrl"
						type="text"
						value={syncUrl}
						onChange={(e) => setSyncUrl(e.target.value)}
						placeholder="libsql://your-database.turso.io"
						className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p className="text-xs text-gray-500 mt-1">
						Your Turso database URL (e.g., libsql://[db-name]-[org].turso.io)
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1" htmlFor="authToken">
						Auth Token
					</label>
					<input
						id="authToken"
						type="password"
						value={authToken}
						onChange={(e) => setAuthToken(e.target.value)}
						placeholder="your-turso-auth-token"
						className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<p className="text-xs text-gray-500 mt-1">
						Your Turso database authentication token
					</p>
				</div>

				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleConfigureSync}
						disabled={!syncUrl || !authToken || configureMutation.isPending}
						className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
					>
						{configureMutation.isPending ? "Configuring..." : "Configure Sync"}
					</button>

					{config.enableSync && (
						<>
							<button
								type="button"
								onClick={handleSyncNow}
								disabled={syncMutation.isPending}
								className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{syncMutation.isPending ? "Syncing..." : "Sync Now"}
							</button>

							<button
								type="button"
								onClick={handleDisableSync}
								disabled={disableMutation.isPending}
								className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
							>
								{disableMutation.isPending ? "Disabling..." : "Disable Sync"}
							</button>
						</>
					)}
				</div>

				{message && (
					<div
						className={`p-3 rounded ${
							message.startsWith("Error")
								? "bg-red-100 text-red-700"
								: "bg-green-100 text-green-700"
						}`}
					>
						{message}
					</div>
				)}
			</div>

			<div className="mt-6 p-4 bg-gray-50 rounded">
				<h3 className="font-semibold mb-2">How to set up Turso sync:</h3>
				<ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
					<li>
						Create a Turso account at{" "}
						<a
							href="https://turso.tech"
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-600 hover:underline"
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
