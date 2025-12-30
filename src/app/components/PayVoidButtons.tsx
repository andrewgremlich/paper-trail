import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimesheetDetails } from "@/lib/db/types";
import { getInvoice, markInvoiceAsPaid, voidInvoice } from "@/lib/stripeApi";
import { Button } from "./Button";
import { Flex } from "./Flex";
import { P } from "./HtmlElements";

export const PayVoidButtons = ({
	timesheet,
}: {
	timesheet: TimesheetDetails;
}) => {
	const queryClient = useQueryClient();
	const { data: invoiceData } = useQuery({
		queryKey: ["invoice", timesheet?.invoiceId],
		queryFn: async () => {
			if (!timesheet?.invoiceId) {
				return null;
			}
			return await getInvoice(timesheet.invoiceId);
		},
		// TODO: re-enable when needed
		// enabled: !!timesheet?.invoiceId,
	});
	// TODO: whenever an invoice is paid, add to transaction history
	const { mutate: markAsPaid } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await markInvoiceAsPaid(invoiceId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["invoice", timesheet?.invoiceId],
			});
		},
	});
	const { mutate: voidInv } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await voidInvoice(invoiceId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["invoice", timesheet?.invoiceId],
			});
		},
	});

	return (
		<>
			{invoiceData?.status === "paid" && (
				<P>Invoice has been marked as paid.</P>
			)}
			{invoiceData?.pdf && (
				<P>
					Invoice PDF is available.{" "}
					<a
						className="text-blue-500 underline underline-offset-4 decoration-dashed"
						href={invoiceData.pdf}
						target="_blank"
						rel="noopener noreferrer"
					>
						Download PDF
					</a>
				</P>
			)}
			{invoiceData?.status === "void" && <P>Invoice has been voided.</P>}
			<Flex gap={8}>
				<Button
					onClick={async () => {
						if (timesheet?.invoiceId) await markAsPaid(timesheet?.invoiceId);
					}}
					disabled={invoiceData?.disabled ?? false}
				>
					{invoiceData?.status === "paid"
						? "Already Paid"
						: invoiceData?.disabled
							? "Disabled"
							: "Mark as Paid"}
				</Button>
				<Button
					onClick={async () => {
						if (timesheet?.invoiceId) await voidInv(timesheet?.invoiceId);
					}}
					disabled={invoiceData?.disabled ?? false}
				>
					{invoiceData?.status === "void"
						? "Already Voided"
						: invoiceData?.disabled
							? "Void Disabled"
							: "Void Invoice"}
				</Button>
			</Flex>
		</>
	);
};
