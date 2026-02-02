import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import type { Timesheet } from "@/lib/db/types";
import { getInvoice, markInvoiceAsPaid, voidInvoice } from "@/lib/stripeApi";
import styles from "./styles.module.css";
import { ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

export const PayVoidButtons = ({
	timesheet,
}: {
	timesheet: Pick<Timesheet, "invoiceId">;
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
			<Flex gap={8} className={styles.buttonContainer}>
				<Button
					size="sm"
					onClick={async () => {
						if (invoiceId) await markAsPaid(invoiceId);
					}}
					disabled={isDisabled}
				>
					{payLabel}
				</Button>
				<Button
					size="sm"
					onClick={async () => {
						if (invoiceId) await voidInv(invoiceId);
					}}
					disabled={isDisabled}
				>
					{voidLabel}
				</Button>
			</Flex>
			{invoiceData?.status === "paid" && (
				<P>Invoice has been marked as paid.</P>
			)}
			{invoiceData?.invoice_pdf ? (
				<Button
					type="button"
					variant="secondary"
					onClick={() => {
						const pdfUrl = invoiceData.invoice_pdf;
						if (pdfUrl) openUrl(pdfUrl);
					}}
					leftIcon={<ExternalLink size={16} />}
				>
					View PDF
				</Button>
			) : null}
			{invoiceData?.status === "void" && <P>Invoice has been voided.</P>}
		</>
	);
};
