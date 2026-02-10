import { useId } from "react";
import { P } from "@/components/layout/HtmlElements";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { ExportImportSection } from "../ExportImportSection";
import { StripeSecretSection } from "../StripeSecretSection";
import { ThemeSection } from "../ThemeSection";
import { SyncSettings } from "../SyncSettings";

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
				headingId={headingId}
				onClose={toggleSettingsModal}
				closeAriaLabel="Close settings"
			/>
			<P>
				Application settings. Store your Stripe Secret Key securely (never
				exposed outside the local vault).
			</P>
			<StripeSecretSection active={settingsModalActive} idPrefix={headingId} />
			<SyncSettings />
			<ThemeSection />
			<ExportImportSection />
		</Dialog>
	);
};
