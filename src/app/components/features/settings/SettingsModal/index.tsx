import { useId } from "react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { ExportImportSection } from "../ExportImportSection";
import { StripeSecretSection } from "../StripeSecretSection";
import { SyncSettings } from "../SyncSettings";
import { ThemeSection } from "../ThemeSection";

export const SettingsModal = () => {
	const { settingsModalActive, toggleSettingsModal } = usePaperTrailStore();
	const headingId = useId();

	return (
		<Dialog
			isOpen={settingsModalActive}
			variant="liquidGlass"
			onClose={toggleSettingsModal}
			titleId={headingId}
		>
			<ModalHeader
				title="Settings"
				description="Modify settings for the application here."
				headingId={headingId}
				onClose={toggleSettingsModal}
				closeAriaLabel="Close settings"
			/>
			<StripeSecretSection active={settingsModalActive} idPrefix={headingId} />
			<SyncSettings />
			<ThemeSection />
			<ExportImportSection />
		</Dialog>
	);
};
