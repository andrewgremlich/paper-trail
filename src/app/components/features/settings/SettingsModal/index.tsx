import { X } from "lucide-react";
import { useId, useRef } from "react";
import { H2, P } from "@/components/layout/HtmlElements";
import { Dialog } from "@/components/ui/Dialog";
import { usePaperTrailStore } from "@/lib/store";
import { ExportImportSection } from "../ExportImportSection";
import { StripeSecretSection } from "../StripeSecretSection";
import { ThemeSection } from "../ThemeSection";
import styles from "./styles.module.css";

export const SettingsModal = () => {
	const { settingsModalActive, toggleSettingsModal } = usePaperTrailStore();
	const headingId = useId();
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);

	return (
		<Dialog
			isOpen={settingsModalActive}
			variant="liquidGlass"
			onClose={toggleSettingsModal}
			titleId={headingId}
			returnFocusRef={closeButtonRef as unknown as React.RefObject<HTMLElement>}
		>
			<header className={styles.header}>
				<H2 id={headingId}>Settings</H2>
				<button
					ref={closeButtonRef}
					type="button"
					onClick={toggleSettingsModal}
					aria-label="Close settings"
					className={styles.closeButton}
				>
					<X />
				</button>
			</header>
			<P>
				Application settings. Store your Stripe Secret Key securely (never
				exposed outside the local vault).
			</P>
			<StripeSecretSection active={settingsModalActive} idPrefix={headingId} />
			<ThemeSection />
			<ExportImportSection />
			<div className={styles.footer}>
				<button
					type="button"
					onClick={toggleSettingsModal}
					className={styles.footerButton}
				>
					Close
				</button>
			</div>
		</Dialog>
	);
};
