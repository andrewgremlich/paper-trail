import { X } from "lucide-react";
import { useId, useRef } from "react";
import { H2 } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { CreateInvoiceForm } from "../CreateInvoiceForm";
import { InvoiceDetails } from "../InvoiceDetails";

export const InvoiceModal = () => {
	const { invoiceModalActive, toggleInvoiceModal, activeInvoiceId } =
		usePaperTrailStore();
	const headingId = useId();
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);

	const isViewMode = !!activeInvoiceId;

	return (
		<Dialog
			isOpen={invoiceModalActive}
			variant="liquidGlass"
			onClose={() => toggleInvoiceModal()}
			titleId={headingId}
			returnFocusRef={closeButtonRef as unknown as React.RefObject<HTMLElement>}
		>
			<header>
				<H2 id={headingId}>
					{isViewMode ? "Invoice Details" : "Create Invoice"}
				</H2>
				<button
					ref={closeButtonRef}
					type="button"
					onClick={() => toggleInvoiceModal()}
					aria-label="Close modal"
				>
					<X />
				</button>
			</header>

			{isViewMode ? (
				<InvoiceDetails invoiceId={activeInvoiceId} />
			) : (
				<CreateInvoiceForm />
			)}

			{isViewMode && (
				<div>
					<Button
						type="button"
						variant="secondary"
						onClick={() => toggleInvoiceModal()}
					>
						Close
					</Button>
				</div>
			)}
		</Dialog>
	);
};
