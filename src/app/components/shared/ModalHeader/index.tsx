import { Flex } from "@/components/layout/Flex";
import { H2 } from "@/components/layout/HtmlElements";
import { CloseModalButton } from "@/components/shared/CloseModalButton";

interface ModalHeaderProps {
	title: string;
	headingId: string;
	onClose: () => void;
	closeAriaLabel?: string;
}

export const ModalHeader = ({
	title,
	headingId,
	onClose,
	closeAriaLabel,
}: ModalHeaderProps) => {
	return (
		<Flex as="header" justify="between" items="center">
			<H2 id={headingId}>{title}</H2>
			<CloseModalButton onClick={onClose} ariaLabel={closeAriaLabel} />
		</Flex>
	);
};
