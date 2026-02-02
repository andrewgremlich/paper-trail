import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FileText, Mail } from "lucide-react";
import { PayVoidButtons } from "@/components/features/invoices/PayVoidButtons";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { getTimesheetByInvoiceId } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { getInvoice } from "@/lib/stripeApi";
import styles from "./styles.module.css";

interface InvoiceDetailsProps {
	invoiceId: string;
}

function formatCurrency(cents: number, currency: string): string {
	const amount = cents / 100;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: currency.toUpperCase(),
	}).format(amount);
}

function formatDate(timestamp: number): string {
	return new Date(timestamp * 1000).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

function getStatusLabel(status: string | null): string {
	switch (status) {
		case "paid":
			return "Paid";
		case "void":
			return "Void";
		case "open":
			return "Open";
		case "draft":
			return "Draft";
		default:
			return "Unknown";
	}
}

export const InvoiceDetails = ({ invoiceId }: InvoiceDetailsProps) => {
	const { toggleInvoiceModal, toggleTimesheetModal } = usePaperTrailStore();
	const { data: invoice, isLoading: invoiceLoading } = useQuery({
		queryKey: ["invoice-detail", invoiceId],
		queryFn: () => getInvoice(invoiceId),
	});
	const { data: timesheet, isLoading: timesheetLoading } = useQuery({
		queryKey: ["timesheet-by-invoice", invoiceId],
		queryFn: () => getTimesheetByInvoiceId(invoiceId),
	});

	const isLoading = invoiceLoading || timesheetLoading;

	const handleViewTimesheet = () => {
		if (timesheet) {
			toggleInvoiceModal();
			toggleTimesheetModal({ timesheetId: timesheet.id });
		}
	};

	if (isLoading) {
		return <P>Loading invoice details...</P>;
	}

	if (!invoice) {
		return <P>Invoice not found.</P>;
	}

	return (
		<>
			{invoice.description && <P className={styles.preLine}>{invoice.description}</P>}

			<Grid rows={4} flow="col" columnGap={24}>
				<P>Invoice ID: {invoice.id}</P>
				{invoice.number && <P>Invoice Number: {invoice.number}</P>}
				<P>
					Customer:{" "}
					<button
						type="button"
						className={styles.linkButton}
						onClick={() => {
							if (invoice.customer_email) {
								openUrl(`mailto:${invoice.customer_email}`);
							}
						}}
					>
						<Mail size={14} />
						{invoice.customer_name}
					</button>
				</P>
				<P>
					Amount:{" "}
					{invoice.amount_due !== undefined
						? formatCurrency(invoice.amount_due, invoice.currency || "usd")
						: "N/A"}
				</P>
				<P>Status: {getStatusLabel(invoice.status)}</P>
				{invoice.created && <P>Created: {formatDate(invoice.created)}</P>}
			</Grid>

			{invoice.footer && <P className={styles.preLine}>{invoice.footer}</P>}

			<Flex gap={12} className={styles.actions} items="center">
				{timesheet ? (
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
						<em>No linked timesheet found</em>
					</span>
				)}
			</Flex>

			{timesheet && <PayVoidButtons timesheet={timesheet} />}
		</>
	);
};
