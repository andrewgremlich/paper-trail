import { useId } from "react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { DeleteDataSection } from "../DeleteDataSection";
import { EmailDeliverySection } from "../EmailDeliverySection";
import { ExportImportSection } from "../ExportImportSection";
import { InvoiceProfileSection } from "../InvoiceProfileSection";
import { ThemeSection } from "../ThemeSection";

export const SettingsModal = () => {
	const { activeModal, closeModal } = usePaperTrailStore();
	const headingId = useId();

	return (
		<Dialog
			isOpen={activeModal?.type === "settings"}
			onClose={closeModal}
			titleId={headingId}
		>
			<ModalHeader
				title="Settings"
				description="Modify settings for the application here."
				headingId={headingId}
				onClose={closeModal}
				closeAriaLabel="Close settings"
			/>
			<ThemeSection />
			<InvoiceProfileSection />
			<EmailDeliverySection />
			<ExportImportSection />
			<DeleteDataSection />
		</Dialog>
	);
};
