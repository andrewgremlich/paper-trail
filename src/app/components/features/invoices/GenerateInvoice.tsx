import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { TimesheetDetails } from "@/lib/db";
import { generateInvoice } from "@/lib/stripeApi";

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
				className="mb-4"
				disabled={!timesheet?.active || timesheet?.entries.length === 0}
			>
				{isPending
					? "Generating..."
					: timesheet?.active
						? "Generate Invoice"
						: "Invoice Generated"}
			</Button>
			{isSuccess && (
				<div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
					{timesheet?.invoiceId
						? `Invoice ${timesheet.invoiceId} generated successfully!`
						: "Action completed successfully!"}
				</div>
			)}
			{isError && (
				<div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
					Error: {isError}
				</div>
			)}
		</form>
	);
};
