import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { getTimesheetByInvoiceId } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import type { StripeInvoiceListItem } from "@/lib/stripeApi";
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

function getStatusClass(status: string | null): string {
	switch (status) {
		case "paid":
			return styles.statusPaid;
		case "void":
			return styles.statusVoid;
		case "open":
			return styles.statusOpen;
		case "draft":
			return styles.statusDraft;
		default:
			return "";
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

	const invoiceData = invoice as StripeInvoiceListItem;

	return (
		<div className={styles.container}>
			<Flex direction="col" gap={16}>
				<div className={styles.detailRow}>
					<span className={styles.label}>Invoice ID</span>
					<span className={styles.value}>{invoiceData.id}</span>
				</div>

				{invoiceData.number && (
					<div className={styles.detailRow}>
						<span className={styles.label}>Invoice Number</span>
						<span className={styles.value}>{invoiceData.number}</span>
					</div>
				)}

				<div className={styles.detailRow}>
					<span className={styles.label}>Customer</span>
					<span className={styles.value}>
						{invoiceData.customerName || invoiceData.customerEmail || "N/A"}
					</span>
				</div>

				<div className={styles.detailRow}>
					<span className={styles.label}>Amount</span>
					<span className={styles.value}>
						{invoiceData.amountDue !== undefined
							? formatCurrency(
									invoiceData.amountDue,
									invoiceData.currency || "usd",
								)
							: "N/A"}
					</span>
				</div>

				<div className={styles.detailRow}>
					<span className={styles.label}>Status</span>
					<span
						className={`${styles.value} ${styles.status} ${getStatusClass(invoiceData.status)}`}
					>
						{invoiceData.status || "Unknown"}
					</span>
				</div>

				{invoiceData.created && (
					<div className={styles.detailRow}>
						<span className={styles.label}>Created</span>
						<span className={styles.value}>
							{formatDate(invoiceData.created)}
						</span>
					</div>
				)}

				<Flex gap={12} className={styles.actions}>
					{invoiceData.pdf && (
						<a
							href={invoiceData.pdf}
							target="_blank"
							rel="noopener noreferrer"
							className={styles.pdfLink}
						>
							<ExternalLink size={16} />
							View PDF
						</a>
					)}

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
						<P className={styles.noTimesheet}>
							<em>No linked timesheet found</em>
						</P>
					)}
				</Flex>
			</Flex>
		</div>
	);
};
