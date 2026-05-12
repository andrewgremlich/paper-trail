import { ModalHeader } from "@/components/shared/ModalHeader";
import { Dialog } from "@/components/ui/Dialog";
import type { Customer } from "@/lib/db/types";
import { GenerateProject } from "../GenerateProject";

type Props = {
	isOpen: boolean;
	customers?: Customer[];
	onClose: () => void;
	onSuccess: () => void;
};

const HEADING_ID = "generate-project-heading";

export const GenerateProjectDialog = ({
	isOpen,
	customers,
	onClose,
	onSuccess,
}: Props) => (
	<Dialog isOpen={isOpen} onClose={onClose} titleId={HEADING_ID}>
		<ModalHeader
			title="New Project"
			headingId={HEADING_ID}
			onClose={onClose}
			closeAriaLabel="Close new project dialog"
		/>
		<GenerateProject customers={customers} onSuccess={onSuccess} />
	</Dialog>
);
