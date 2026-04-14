import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { deleteAllUserData } from "@/lib/db/userProfile";
import styles from "./styles.module.css";

const CONFIRM_PHRASE = "DELETE";

export const DeleteDataSection = () => {
	const queryClient = useQueryClient();
	const [confirmText, setConfirmText] = useState("");

	const deleteMutation = useMutation({
		mutationFn: deleteAllUserData,
		onSuccess: async () => {
			setConfirmText("");
			await queryClient.invalidateQueries();
		},
	});

	const isConfirmed = confirmText === CONFIRM_PHRASE;

	return (
		<div className={styles.container}>
			<H3>Delete All Data</H3>
			<P>
				Permanently delete all your projects, timesheets, transactions, and
				connected Stripe account. Your login account will remain. This cannot be
				undone.
			</P>

			<label htmlFor="delete-confirm-input" className={styles.confirmLabel}>
				Type <strong>{CONFIRM_PHRASE}</strong> to confirm
			</label>
			<Input
				id="delete-confirm-input"
				type="text"
				value={confirmText}
				onChange={(e) => setConfirmText(e.target.value)}
				placeholder={CONFIRM_PHRASE}
				disabled={deleteMutation.isPending || deleteMutation.isSuccess}
				aria-describedby="delete-confirm-hint"
				autoComplete="off"
			/>
			<P id="delete-confirm-hint" className={styles.hint}>
				This will remove all projects, timesheets, timesheet entries, and
				transactions from your account.
			</P>

			<Button
				onClick={() => deleteMutation.mutate()}
				disabled={
					!isConfirmed || deleteMutation.isPending || deleteMutation.isSuccess
				}
				isLoading={deleteMutation.isPending}
				leftIcon={<Trash2 size={16} aria-hidden="true" />}
				variant="destructive"
				aria-label="Delete all user data"
			>
				Delete All Data
			</Button>

			{deleteMutation.isSuccess && (
				<P className={styles.successMessage}>
					All data has been deleted successfully.
				</P>
			)}

			{deleteMutation.isError && (
				<P className={styles.errorMessage}>
					Failed to delete data:{" "}
					{deleteMutation.error instanceof Error
						? deleteMutation.error.message
						: "Unknown error"}
				</P>
			)}
		</div>
	);
};
