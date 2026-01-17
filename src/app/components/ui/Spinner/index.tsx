import styles from "./styles.module.css";

export function Spinner({ className }: { className?: string }) {
	const spinnerClasses = className
		? `${styles.spinner} ${className}`
		: styles.spinner;

	return (
		<svg
			className={spinnerClasses}
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				className={styles.circle}
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className={styles.path}
				fill="currentColor"
				d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
			/>
		</svg>
	);
}
