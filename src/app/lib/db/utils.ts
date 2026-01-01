export const normalizeDateInput = (raw: string): string => {
	const s = raw.trim();
	if (!s) {
		throw new Error("Missing date");
	}
	// Accept ISO-like strings and take the leading YYYY-MM-DD
	const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (isoPrefix) {
		const [_, y, m, d] = isoPrefix;
		return `${y}-${m}-${d}`;
	}
	// Accept MM/DD/YYYY
	const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (us) {
		const mm = us[1].padStart(2, "0");
		const dd = us[2].padStart(2, "0");
		const yyyy = us[3];
		return `${yyyy}-${mm}-${dd}`;
	}
	// Accept YYYY/MM/DD
	const ymdSlashes = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
	if (ymdSlashes) {
		const yyyy = ymdSlashes[1];
		const mm = ymdSlashes[2].padStart(2, "0");
		const dd = ymdSlashes[3].padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	}
	throw new Error("Invalid date format. Expected YYYY-MM-DD");
};
