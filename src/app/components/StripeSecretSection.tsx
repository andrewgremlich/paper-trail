import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";

import { getStripeSecretKey, setStripeSecretKey } from "../lib/stronghold";

interface StripeSecretSectionProps {
	active: boolean; // whether the parent modal is open
	idPrefix?: string; // optional ID prefix to keep IDs unique in parent
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
			className="space-y-1"
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
				className="block text-xs font-medium text-neutral-500 dark:text-neutral-400"
			>
				Stripe Secret Key
			</label>
			<div className="flex gap-2">
				<input
					id={inputId}
					name="stripeKey"
					type="password"
					spellCheck={false}
					placeholder="sk_live_..."
					defaultValue={stripeKey ?? ""}
					className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white text-black dark:bg-neutral-800 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
				/>
				<button
					type="submit"
					className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
				>
					{isPending ? "Saving" : isSuccess ? "Saved" : "Save"}
				</button>
			</div>
			{isError && (
				<span className="text-xs text-red-600 dark:text-red-400">
					Error saving key
				</span>
			)}
		</form>
	);
};
