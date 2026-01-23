import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TimesheetDetails } from "@/lib/db";
import { generateInvoice } from "@/lib/stripeApi";
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
	} = useMutation({
		mutationFn: async (formData: FormData) => {
			await generateInvoice(formData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
	});

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				const formData = new FormData(e.currentTarget);
				await mutateInvoice(formData);
			}}
		>
			<Input type="hidden" name="timesheetId" defaultValue={timesheet?.id} />
			{timesheet?.customerId && (
				<Input
					type="hidden"
					name="customerId"
					defaultValue={timesheet?.customerId}
				/>
			)}
			<Button
				type="submit"
				variant="default"
				className={styles.button}
				disabled={!timesheet?.active || timesheet?.entries.length === 0}
				isLoading={isPending}
			>
				{timesheet?.active ? "Generate Invoice" : "Invoice Generated"}
			</Button>
			<div aria-live="polite" aria-atomic="true">
				{isSuccess && (
					<div className={styles.successMessage}>
						{timesheet?.invoiceId
							? `Invoice ${timesheet.invoiceId} generated successfully!`
							: "Action completed successfully!"}
					</div>
				)}
				{isError && <div className={styles.errorMessage}>Error: {isError}</div>}
			</div>
		</form>
	);
};
