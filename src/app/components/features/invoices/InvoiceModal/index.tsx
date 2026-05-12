import { useId } from "react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { CreateInvoiceForm } from "../CreateInvoiceForm";
import { InvoiceDetails } from "../InvoiceDetails";

export const InvoiceModal = () => {
	const { activeModal, closeModal } = usePaperTrailStore();
	const headingId = useId();

	const activeInvoiceId =
		activeModal?.type === "invoice" ? activeModal.invoiceId : undefined;
	const isViewMode = !!activeInvoiceId;

	return (
		<Dialog
			isOpen={activeModal?.type === "invoice"}
			onClose={closeModal}
			titleId={headingId}
		>
			<ModalHeader
				title={isViewMode ? "Invoice Details" : "Create Invoice"}
				headingId={headingId}
				onClose={closeModal}
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
