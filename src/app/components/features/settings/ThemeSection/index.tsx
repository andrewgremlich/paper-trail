import { Monitor, Moon, Sun } from "lucide-react";
import { H3, P } from "@/components/layout/HtmlElements";
import { type Theme, usePaperTrailStore } from "@/lib/store";
import styles from "./styles.module.css";

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
	{ value: "light", label: "Light", icon: <Sun size={16} /> },
	{ value: "dark", label: "Dark", icon: <Moon size={16} /> },
	{ value: "system", label: "System", icon: <Monitor size={16} /> },
];

export const ThemeSection = () => {
	const { theme, setTheme } = usePaperTrailStore();

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<H3>Appearance</H3>
				<P className={styles.description}>
					Choose your preferred color theme for the application.
				</P>
			</div>

			<fieldset className={styles.fieldset}>
				<legend className={styles.visuallyHidden}>Theme</legend>
				<div className={styles.buttonGroup}>
					{themeOptions.map((option) => (
						<label
							key={option.value}
							className={
								theme === option.value
									? styles.themeButtonActive
									: styles.themeButton
							}
						>
							<input
								type="radio"
								name="theme"
								value={option.value}
								checked={theme === option.value}
								onChange={() => setTheme(option.value)}
								className={styles.visuallyHidden}
							/>
							{option.icon}
							{option.label}
						</label>
					))}
				</div>
			</fieldset>
		</div>
	);
};
