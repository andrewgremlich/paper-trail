import { Flex } from "@/components/layout/Flex";
import { H2 } from "@/components/layout/HtmlElements";
import { CloseModalButton } from "@/components/shared/CloseModalButton";

interface ModalHeaderProps {
	title: string;
	description?: string;
	headingId: string;
	onClose: () => void;
	closeAriaLabel?: string;
}

export const ModalHeader = ({
	title,
	description,
	headingId,
	onClose,
	closeAriaLabel,
}: ModalHeaderProps) => {
	return (
		<header style={{ marginBottom: "1rem" }}>
			<Flex justify="between" items="center">
				<H2 id={headingId} style={{ marginBottom: 0 }}>
					{title}
				</H2>
				<CloseModalButton onClick={onClose} ariaLabel={closeAriaLabel} />
			</Flex>
			{description && (
				<p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
					{description}
				</p>
			)}
		</header>
	);
};
