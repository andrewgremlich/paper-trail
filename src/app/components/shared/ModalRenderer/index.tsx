import { InvoiceModal } from "@/components/features/invoices/InvoiceModal";
import { ProjectModal } from "@/components/features/projects/ProjectModal";
import { SettingsModal } from "@/components/features/settings/SettingsModal";
import { TimesheetModal } from "@/components/features/timesheets/TimesheetModal";

export const ModalRenderer = () => (
	<>
		<TimesheetModal />
		<ProjectModal />
		<SettingsModal />
		<InvoiceModal />
	</>
);
