import { X } from "lucide-react";
import { useId, useRef } from "react";
import { usePaperTrailStore } from "../lib/store";
import { Dialog } from "./Dialog";
import { ExportImportSection } from "./ExportImportSection";
import { H2, P } from "./HtmlElements";
import { StripeSecretSection } from "./StripeSecretSection";

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
			<header className="flex items-center justify-between">
				<H2 id={headingId}>Settings</H2>
				<button
					ref={closeButtonRef}
					type="button"
					onClick={toggleSettingsModal}
					aria-label="Close settings"
					className="cursor-pointer text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
				>
					<X />
				</button>
			</header>
			<P>
				Application settings. Store your Stripe Secret Key securely (never
				exposed outside the local vault).
			</P>
			<StripeSecretSection active={settingsModalActive} idPrefix={headingId} />
			<ExportImportSection />
			<div className="flex justify-end gap-2 pt-2">
				<button
					type="button"
					onClick={toggleSettingsModal}
					className="dark:text-primary-foreground text-black px-3 py-1.5 rounded border text-sm border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
				>
					Close
				</button>
			</div>
		</Dialog>
	);
};
