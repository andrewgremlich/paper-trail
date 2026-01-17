import { type ClassValue, clsx } from "clsx";
import { format as formatFn } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}

export function formatDate(
	input: Date | string | number,
	options?: { includeTime?: boolean; format?: string },
): string {
	const date = (() => {
		if (input instanceof Date) return input;
		if (typeof input === "number") return new Date(input);
		if (typeof input === "string") {
			const s = input.trim();
			// Handle date-only strings (YYYY-MM-DD) as local dates to avoid UTC shift
			const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
			if (dateOnly.test(s)) {
				const [y, m, d] = s.split("-").map((v) => Number(v));
				return new Date(y, m - 1, d);
			}
			return new Date(s);
		}
		return new Date(input as number);
	})();
	if (Number.isNaN(date.getTime())) return "";
	const pattern =
		options?.format ??
		(options?.includeTime ? "MMM d, yyyy, p" : "MMM d, yyyy");
	return formatFn(date, pattern);
}
