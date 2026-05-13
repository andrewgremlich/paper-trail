import { useQuery } from "@tanstack/react-query";
import { FileText, Mail } from "lucide-react";
import { PayVoidButtons } from "@/components/features/invoices/PayVoidButtons";
import { Flex } from "@/components/layout/Flex";
import { P, Span } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { getCustomer } from "@/lib/db/customers";
import { getInvoice } from "@/lib/db/invoices";
import { getTimesheetByInvoiceId } from "@/lib/db/timesheets";
import type { Invoice } from "@/lib/db/types";
import { usePaperTrailStore } from "@/lib/store";
import styles from "./styles.module.css";

interface InvoiceDetailsProps {
	invoiceId: string;
}

const formatCents = (cents: number): string =>
	(cents / 100).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});

const statusLabel = (status: Invoice["status"]): string => {
	switch (status) {
		case "paid":
			return "Paid";
		case "void":
			return "Void";
		case "sent":
			return "Sent";
		case "draft":
			return "Draft";
	}
};

export const InvoiceDetails = ({ invoiceId }: InvoiceDetailsProps) => {
	const { openModal, closeModal } = usePaperTrailStore();

	const { data: invoice, isLoading: invoiceLoading } = useQuery({
		queryKey: ["invoice-detail", invoiceId],
		queryFn: () => getInvoice(invoiceId),
	});

	const { data: customer } = useQuery({
		queryKey: ["customer", invoice?.customerId],
		queryFn: () => {
			if (!invoice) throw new Error("invoice not loaded");
			return getCustomer(invoice.customerId);
		},
		enabled: !!invoice?.customerId,
	});

	const { data: timesheet } = useQuery({
		queryKey: ["timesheet-by-invoice", invoiceId],
		queryFn: () => getTimesheetByInvoiceId(invoiceId),
		enabled: !!invoice?.timesheetId,
	});

	const handleViewTimesheet = () => {
		if (timesheet) {
			closeModal();
			openModal({ type: "timesheet", timesheetId: timesheet.id });
		}
	};

	if (invoiceLoading) {
		return <P>Loading invoice details...</P>;
	}
	if (!invoice) {
		return <P>Invoice not found.</P>;
	}

	return (
		<>
			{invoice.description && (
				<P className={styles.preLine}>{invoice.description}</P>
			)}

			<Grid cols={2}>
				<Span>Invoice Number: {invoice.number}</Span>
				<Span>
					Customer:{" "}
					{customer ? (
						<button
							type="button"
							className={styles.linkButton}
							onClick={() => window.open(`mailto:${customer.email}`, "_blank")}
						>
							<Mail size={14} />
							{customer.name}
						</button>
					) : (
						"…"
					)}
				</Span>
				<Span>Amount: {formatCents(invoice.amount_cents)}</Span>
				<Span>Status: {statusLabel(invoice.status)}</Span>
				<Span>Issued: {invoice.issuedAt}</Span>
				<Span>Due: {invoice.dueDate}</Span>
				{invoice.sentAt && <P>Sent: {invoice.sentAt.slice(0, 10)}</P>}
				{invoice.paidAt && <P>Paid: {invoice.paidAt.slice(0, 10)}</P>}
			</Grid>

			<Flex gap={12} className={styles.actions} items="center">
				{invoice.timesheetId &&
					(timesheet ? (
						<Button
							type="button"
							variant="secondary"
							onClick={handleViewTimesheet}
							leftIcon={<FileText size={16} />}
						>
							View Timesheet: {timesheet.name}
						</Button>
					) : (
						<span>
							<em>Loading timesheet…</em>
						</span>
					))}
			</Flex>

			<PayVoidButtons invoice={invoice} />
		</>
	);
};
