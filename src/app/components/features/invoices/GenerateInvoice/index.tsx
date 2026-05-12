import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import type { TimesheetDetails } from "@/lib/db";
import { createInvoice } from "@/lib/db/invoices";
import styles from "./styles.module.css";

export const GenerateInvoice = ({
	timesheet,
	activeTimesheetId,
}: {
	timesheet: TimesheetDetails;
	activeTimesheetId: number;
}) => {
	const queryClient = useQueryClient();
	const {
		mutate: mutateInvoice,
		isPending,
		isSuccess,
		isError,
		data,
	} = useMutation({
		mutationFn: async () => {
			if (timesheet.customerId == null) {
				throw new Error(
					"This project has no customer linked. Open Customers and attach one to the project first.",
				);
			}
			return createInvoice({
				timesheetId: timesheet.id,
				customerId: timesheet.customerId,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
			await queryClient.invalidateQueries({ queryKey: ["invoices"] });
		},
	});

	const canGenerate =
		timesheet?.active &&
		timesheet?.entries.length > 0 &&
		timesheet?.customerId != null;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				mutateInvoice();
			}}
		>
			<Button
				type="submit"
				variant="default"
				className={styles.button}
				disabled={!canGenerate}
				isLoading={isPending}
			>
				{timesheet?.active ? "Generate Invoice" : "Invoice Generated"}
			</Button>
			{timesheet?.customerId == null && (
				<div className={styles.errorMessage}>
					Attach a customer to this project before generating an invoice.
				</div>
			)}
			<div aria-live="polite" aria-atomic="true">
				{isSuccess && data && (
					<div className={styles.successMessage}>
						Invoice {data.number} created as a draft.
					</div>
				)}
				{isError && (
					<div className={styles.errorMessage}>
						Could not generate invoice.
					</div>
				)}
			</div>
		</form>
	);
};
