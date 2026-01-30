import { useId } from "react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { CreateInvoiceForm } from "../CreateInvoiceForm";
import { InvoiceDetails } from "../InvoiceDetails";

export const InvoiceModal = () => {
	const { invoiceModalActive, toggleInvoiceModal, activeInvoiceId } =
		usePaperTrailStore();
	const headingId = useId();

	const isViewMode = !!activeInvoiceId;

	return (
		<Dialog
			isOpen={invoiceModalActive}
			variant="liquidGlass"
			onClose={() => toggleInvoiceModal()}
			titleId={headingId}
		>
			<ModalHeader
				title={isViewMode ? "Invoice Details" : "Create Invoice"}
				headingId={headingId}
				onClose={() => toggleInvoiceModal()}
				closeAriaLabel="Close Invoice Modal"
			/>

			{isViewMode ? (
				<InvoiceDetails invoiceId={activeInvoiceId} />
			) : (
				<CreateInvoiceForm />
			)}
		</Dialog>
	);
};
