import type { KeyboardEvent } from "react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Card } from "@/components/ui/Card";
import styles from "./styles.module.css";

export const CardPreview = ({
	name,
	description,
	action,
	ariaLabel,
}: {
	name: string;
	description: string;
	action: () => void;
	ariaLabel?: string;
}) => {
	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			action();
		}
	};

	return (
		<Card
			className={styles.card}
			onClick={action}
			onKeyDown={handleKeyDown}
			role="button"
			tabIndex={0}
			aria-label={ariaLabel}
		>
			<H3>{name}</H3>
			<P>{description}</P>
		</Card>
	);
};
