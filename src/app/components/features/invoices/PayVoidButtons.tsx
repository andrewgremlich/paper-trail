import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import type { TimesheetDetails } from "@/lib/db/types";
import { getInvoice, markInvoiceAsPaid, voidInvoice } from "@/lib/stripeApi";

export const PayVoidButtons = ({
	timesheet,
}: {
	timesheet: TimesheetDetails;
}) => {
	const queryClient = useQueryClient();
	const invoiceId = timesheet?.invoiceId;
	const { data: invoiceData } = useQuery({
		queryKey: ["invoice", invoiceId],
		queryFn: async () => {
			if (!invoiceId) return null;
			return await getInvoice(invoiceId);
		},
		enabled: !!invoiceId,
	});
	const { mutateAsync: markAsPaid, isPending: isMarkingAsPaid } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await markInvoiceAsPaid(invoiceId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["invoice", invoiceId],
			});
		},
	});
	const { mutateAsync: voidInv, isPending: isVoiding } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await voidInvoice(invoiceId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["invoice", invoiceId],
			});
		},
	});

	const isDisabled = Boolean(
		invoiceData?.disabled || isMarkingAsPaid || isVoiding,
	);
	const payLabel =
		invoiceData?.status === "paid"
			? "Already Paid"
			: invoiceData?.disabled || isMarkingAsPaid
				? "Disabled"
				: "Mark as Paid";
	const voidLabel =
		invoiceData?.status === "void"
			? "Already Voided"
			: invoiceData?.disabled || isVoiding
				? "Void Disabled"
				: "Void Invoice";

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
						Open PDF
					</a>
				</P>
			)}
			{invoiceData?.status === "void" && <P>Invoice has been voided.</P>}
			<Flex gap={8}>
				<Button
					onClick={async () => {
						if (invoiceId) await markAsPaid(invoiceId);
					}}
					disabled={isDisabled}
				>
					{payLabel}
				</Button>
				<Button
					onClick={async () => {
						if (invoiceId) await voidInv(invoiceId);
					}}
					disabled={isDisabled}
				>
					{voidLabel}
				</Button>
			</Flex>
		</>
	);
};
