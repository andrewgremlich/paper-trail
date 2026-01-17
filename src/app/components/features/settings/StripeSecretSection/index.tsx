import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";

import { getStripeSecretKey, setStripeSecretKey } from "@/lib/files/stronghold";
import styles from "./styles.module.css";

interface StripeSecretSectionProps {
	active: boolean;
	idPrefix?: string;
}

export const StripeSecretSection = ({ idPrefix }: StripeSecretSectionProps) => {
	const queryClient = useQueryClient();
	const { data: stripeKey } = useQuery({
		queryKey: ["stripeSecretKey"],
		queryFn: getStripeSecretKey,
	});
	const { mutate, isSuccess, isError, isPending } = useMutation({
		mutationFn: (newKey: string) => {
			return setStripeSecretKey(newKey);
		},
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["customers"] }),
				queryClient.invalidateQueries({ queryKey: ["stripeSecretKey"] }),
			]);
		},
	});
	const localId = useId();
	const baseId = idPrefix || localId;
	const inputId = `${baseId}-stripe-key`;

	return (
		<form
			className={styles.form}
			aria-labelledby={`${baseId}-stripe-label`}
			onSubmit={(e) => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				const stripeKeyInput = formData.get("stripeKey") as string;

				if (stripeKeyInput) {
					mutate(stripeKeyInput.trim());
				}
			}}
		>
			<label
				id={`${baseId}-stripe-label`}
				htmlFor={inputId}
				className={styles.label}
			>
				Stripe Secret Key
			</label>
			<div className={styles.inputGroup}>
				<input
					id={inputId}
					name="stripeKey"
					type="password"
					spellCheck={false}
					placeholder="sk_live_..."
					defaultValue={stripeKey ?? ""}
					className={styles.input}
				/>
				<button
					type="submit"
					className={
						isSuccess ? styles.submitButtonSuccess : styles.submitButton
					}
				>
					{isPending ? "Saving" : isSuccess ? "Saved" : "Save"}
				</button>
			</div>
			{isError && <span className={styles.error}>Error saving key</span>}
		</form>
	);
};
