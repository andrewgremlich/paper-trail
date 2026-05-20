import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { UpdateUserProfile } from "@/lib/db/types";
import { getUserProfile, updateUserProfile } from "@/lib/db/userProfile";
import styles from "./styles.module.css";

export const EmailDeliverySection = () => {
	const queryClient = useQueryClient();
	const { data: profile, isLoading } = useQuery({
		queryKey: ["user-profile"],
		queryFn: getUserProfile,
	});

	const { mutate, isPending, isSuccess, isError } = useMutation({
		mutationFn: async (update: Partial<UpdateUserProfile>) => {
			if (!profile) throw new Error("Profile not loaded");
			return updateUserProfile({
				displayName: profile.displayName,
				businessName: profile.businessName,
				businessAddress: profile.businessAddress,
				venmoHandle: profile.venmoHandle,
				paypalHandle: profile.paypalHandle,
				resendFromAddress: profile.resendFromAddress,
				...update,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["user-profile"] });
		},
	});

	if (isLoading || !profile) {
		return (
			<section className={styles.container}>
				<H3>Email delivery</H3>
				<Spinner />
			</section>
		);
	}

	const status = profile.hasResendApiKey ? (
		<span className={styles.statusConfigured}>
			Your Resend account is configured. Invoice emails are sent from your
			verified domain and include line items and amounts.
		</span>
	) : (
		<span className={styles.statusFallback}>
			Using Paper Trail's shared email account. Customers receive a minimal
			email with a secure link to view the invoice — no amounts or details are
			included in the email body.
		</span>
	);

	return (
		<section className={styles.container}>
			<H3>Email delivery</H3>
			<P className={styles.description}>
				By default, Paper Trail sends invoice emails through a shared Resend
				account, with a minimal link-only template so no invoice details land
				outside your control. To send emails from your own verified domain with
				full invoice content in the email body, paste your Resend API key and
				sender address below.
			</P>

			<div className={styles.statusRow}>{status}</div>

			<form
				key={profile.updatedAt}
				onSubmit={(evt) => {
					evt.preventDefault();
					const formData = new FormData(evt.currentTarget);
					const rawKey = String(formData.get("resendApiKey") ?? "").trim();
					const rawFrom = String(
						formData.get("resendFromAddress") ?? "",
					).trim();
					mutate({
						// Empty key field means "leave existing key alone" — only
						// submit a key when the user actually types one.
						...(rawKey ? { resendApiKey: rawKey } : {}),
						resendFromAddress: rawFrom || null,
					});
				}}
				className={styles.form}
			>
				<Input
					label="Resend API key"
					name="resendApiKey"
					type="password"
					autoComplete="off"
					placeholder={
						profile.hasResendApiKey
							? "••••••••••• (leave blank to keep)"
							: "re_..."
					}
				/>
				<span className={styles.hint}>
					Generated in your Resend dashboard. Stored encrypted at rest; never
					returned by the API.
				</span>
				<Input
					label="From address"
					name="resendFromAddress"
					defaultValue={profile.resendFromAddress ?? ""}
					placeholder="Acme Invoicing <invoices@acme.com>"
				/>
				<span className={styles.hint}>
					Must use a domain you've verified in your Resend account.
				</span>

				<div className={styles.actions}>
					<Button
						type="submit"
						variant="default"
						size="sm"
						leftIcon={<Save size={16} />}
						disabled={isPending}
					>
						{isPending ? "Saving…" : "Save"}
					</Button>
					{profile.hasResendApiKey && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							leftIcon={<Trash2 size={16} />}
							disabled={isPending}
							onClick={() => {
								mutate({
									resendApiKey: null,
									resendFromAddress: null,
								});
							}}
						>
							Clear Resend config
						</Button>
					)}
					{isSuccess && !isPending && (
						<span className={styles.saved} aria-live="polite">
							Saved.
						</span>
					)}
					{isError && !isPending && (
						<span className={styles.error} aria-live="polite">
							Save failed. Please try again.
						</span>
					)}
				</div>
			</form>
		</section>
	);
};
