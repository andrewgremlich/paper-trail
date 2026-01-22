import { useEffect } from "react";
import { usePaperTrailStore } from "./store";

export const useTheme = () => {
	const theme = usePaperTrailStore((state) => state.theme);

	useEffect(() => {
		const root = document.documentElement;

		if (theme === "system") {
			root.removeAttribute("data-theme");
		} else {
			root.setAttribute("data-theme", theme);
		}
	}, [theme]);
};
