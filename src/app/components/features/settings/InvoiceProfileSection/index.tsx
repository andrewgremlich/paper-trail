import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { getUserProfile, updateUserProfile } from "@/lib/db/userProfile";
import styles from "./styles.module.css";

export const InvoiceProfileSection = () => {
	const queryClient = useQueryClient();
	const { data: profile, isLoading } = useQuery({
		queryKey: ["user-profile"],
		queryFn: getUserProfile,
	});

	const { mutate, isPending, isSuccess, isError } = useMutation({
		mutationFn: async (formData: FormData) => {
			return updateUserProfile({
				displayName: String(formData.get("displayName") ?? "").trim(),
				businessName: String(formData.get("businessName") ?? "").trim() || null,
				businessAddress:
					String(formData.get("businessAddress") ?? "").trim() || null,
				venmoHandle: String(formData.get("venmoHandle") ?? "").trim() || null,
				paypalHandle: String(formData.get("paypalHandle") ?? "").trim() || null,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["user-profile"] });
		},
	});

	if (isLoading || !profile) {
		return (
			<section className={styles.container}>
				<H3>Invoice profile</H3>
				<Spinner />
			</section>
		);
	}

	return (
		<section className={styles.container}>
			<H3>Invoice profile</H3>
			<P className={styles.description}>
				Required to send invoices. Customers see your business name and address
				on every invoice; Venmo and PayPal handles produce payment links
				pre-filled with the amount.
			</P>

			<form
				onSubmit={(evt) => {
					evt.preventDefault();
					mutate(new FormData(evt.currentTarget));
				}}
				className={styles.form}
			>
				<Input
					label="Display name"
					name="displayName"
					defaultValue={profile.displayName}
					autoComplete="name"
				/>
				<Input
					label="Reply-to email"
					defaultValue={profile.email}
					disabled
					aria-describedby="email-hint"
				/>
				<span id="email-hint" className={styles.hint}>
					This is your login email and cannot be changed here.
				</span>
				<Input
					label="Business name (shown on invoices)"
					name="businessName"
					defaultValue={profile.businessName ?? ""}
				/>
				<Textarea
					label="Business address (shown on invoices, used for mail-a-check)"
					name="businessAddress"
					defaultValue={profile.businessAddress ?? ""}
					rows={3}
				/>
				<Input
					label="Venmo handle (without @)"
					name="venmoHandle"
					defaultValue={profile.venmoHandle ?? ""}
					placeholder="my-venmo-username"
				/>
				<Input
					label="PayPal.me handle"
					name="paypalHandle"
					defaultValue={profile.paypalHandle ?? ""}
					placeholder="my-paypal-handle"
				/>

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
