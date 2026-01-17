import { H3, P } from "@/components/layout/HtmlElements";
import { Card } from "@/components/ui/Card";
import styles from "./styles.module.css";

export const CardPreview = ({
	name,
	description,
	action,
}: {
	name: string;
	description: string;
	action: () => void;
}) => {
	return (
		<Card className={styles.card} onClick={action}>
			<H3>{name}</H3>
			<P>{description}</P>
		</Card>
	);
};
