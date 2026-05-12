import { InvoiceModal } from "@/components/features/invoices/InvoiceModal";
import { ProjectModal } from "@/components/features/projects/ProjectModal";
import { SettingsModal } from "@/components/features/settings/SettingsModal";
import { TimesheetModal } from "@/components/features/timesheets/TimesheetModal";
import { usePaperTrailStore } from "@/lib/store";

export const ModalRenderer = () => {
	const { activeModal } = usePaperTrailStore();

	switch (activeModal?.type) {
		case "project":
			return <ProjectModal />;
		case "timesheet":
			return <TimesheetModal />;
		case "settings":
			return <SettingsModal />;
		case "invoice":
			return <InvoiceModal />;
		default:
			return null;
	}
};
