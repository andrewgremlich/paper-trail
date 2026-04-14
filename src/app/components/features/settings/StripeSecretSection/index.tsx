import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ExternalLink, Unlink } from "lucide-react";
import { useEffect } from "react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import {
	disconnectStripe,
	getStripeConnectAuthorizeUrl,
	getStripeConnectStatus,
} from "@/lib/stripeApi";
import styles from "./styles.module.css";

export const StripeSecretSection = () => {
	const queryClient = useQueryClient();

	const statusQuery = useQuery({
		queryKey: ["stripe-connect-status"],
		queryFn: getStripeConnectStatus,
	});

	const disconnectMutation = useMutation({
		mutationFn: disconnectStripe,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
		},
	});

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.has("connect_success") || params.has("connect_error")) {
			window.history.replaceState({}, "", window.location.pathname);
			if (params.has("connect_success")) {
				queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
			}
		}
	}, [queryClient]);

	const handleConnect = () => {
		window.location.href = getStripeConnectAuthorizeUrl();
	};

	if (statusQuery.isLoading) {
		return (
			<div className={styles.container}>
				<H3>Stripe Account</H3>
				<P>Checking connection status…</P>
			</div>
		);
	}

	if (statusQuery.isError) {
		return (
			<div className={styles.container}>
				<H3>Stripe Account</H3>
				<P className={styles.error}>Failed to load connection status.</P>
			</div>
		);
	}

	const status = statusQuery.data;

	return (
		<div className={styles.container}>
			<H3>Stripe Account</H3>

			{status?.connected ? (
				<>
					<div className={styles.statusBadge}>
						<CheckCircle size={14} aria-hidden="true" />
						<span>Connected</span>
					</div>
					<P className={styles.hint}>
						Connected as Stripe account{" "}
						<code className={styles.accountId}>{status.stripeUserId}</code>.
						Invoices and customers are managed through your Stripe account.
					</P>
					<P className={styles.hint}>
						Connected on{" "}
						{new Date(status.connectedAt).toLocaleDateString(undefined, {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
						.
					</P>

					<div className={styles.buttonGroup}>
						<Button
							onClick={() => disconnectMutation.mutate()}
							disabled={disconnectMutation.isPending}
							isLoading={disconnectMutation.isPending}
							leftIcon={<Unlink size={16} aria-hidden="true" />}
							variant="outline"
						>
							Disconnect Stripe
						</Button>
					</div>

					{disconnectMutation.isError && (
						<P className={styles.error}>
							Failed to disconnect:{" "}
							{disconnectMutation.error instanceof Error
								? disconnectMutation.error.message
								: "Unknown error"}
						</P>
					)}
				</>
			) : (
				<>
					<P>
						Connect your Stripe account to create and manage invoices and
						customers directly through Paper Trail.
					</P>

					<div className={styles.buttonGroup}>
						<Button
							onClick={handleConnect}
							leftIcon={<ExternalLink size={16} aria-hidden="true" />}
							variant="default"
						>
							Connect Stripe
						</Button>
					</div>
				</>
			)}
		</div>
	);
};
