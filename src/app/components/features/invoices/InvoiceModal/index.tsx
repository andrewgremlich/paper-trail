import { X } from "lucide-react";
import { useId, useRef } from "react";
import { H2, P } from "@/components/layout/HtmlElements";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";

export const InvoiceModal = () => {
	const { invoiceModalActive, toggleInvoiceModal } = usePaperTrailStore();
	const headingId = useId();
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);

	return (
		<Dialog
			isOpen={invoiceModalActive}
			variant="liquidGlass"
			onClose={toggleInvoiceModal}
			titleId={headingId}
			returnFocusRef={closeButtonRef as unknown as React.RefObject<HTMLElement>}
		>
			<header>
				<H2 id={headingId}>Generate Invoice</H2>
				<button
					ref={closeButtonRef}
					type="button"
					onClick={toggleInvoiceModal}
					aria-label="Close settings"
				>
					<X />
				</button>
			</header>
			<P>Generate a one time invoice for your customers here.</P>
			<div>
				<button type="button" onClick={toggleInvoiceModal}>
					Close
				</button>
			</div>
		</Dialog>
	);
};
