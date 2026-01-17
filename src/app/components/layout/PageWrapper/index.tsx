import styles from "./styles.module.css";

export const PageWrapper = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className={styles.wrapper}>
			<div className={styles.container}>{children}</div>
		</div>
	);
};
