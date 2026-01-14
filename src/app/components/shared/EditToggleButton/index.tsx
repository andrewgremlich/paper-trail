import { Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";

type EditToggleButtonProps = {
	enabled?: boolean;
	isEditing: boolean;
	onToggle: () => void;
	ariaLabel?: string;
};

export const EditToggleButton = ({
	enabled = true,
	isEditing,
	onToggle,
	ariaLabel = "Edit",
}: EditToggleButtonProps) => {
	if (!enabled) return null;

	return (
		<Button
			variant={isEditing ? "secondary" : "ghost"}
			size="icon"
			aria-label={ariaLabel}
			onClick={async () => {
				// keep async to align with project guidelines
				onToggle();
			}}
		>
			<Edit className="w-6 h-6" />
		</Button>
	);
};
