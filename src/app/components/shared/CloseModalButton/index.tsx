import { X } from "lucide-react";
import { forwardRef } from "react";
import { Button } from "@/components/ui/Button";

interface CloseModalButtonProps {
	onClick: () => void;
	ariaLabel?: string;
}

export const CloseModalButton = forwardRef<
	HTMLButtonElement,
	CloseModalButtonProps
>(({ onClick, ariaLabel = "Close modal" }, ref) => {
	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			type="button"
			onClick={onClick}
			aria-label={ariaLabel}
		>
			<X />
		</Button>
	);
});

CloseModalButton.displayName = "CloseModalButton";
