export const composeAddress = (formData: FormData): string | null => {
	const road = String(formData.get("road") ?? "").trim();
	const city = String(formData.get("city") ?? "").trim();
	const state = String(formData.get("state") ?? "").trim();
	const zip = String(formData.get("zip") ?? "").trim();
	const parts = [road, city, state, zip].filter(Boolean);
	return parts.length > 0 ? parts.join("\n") : null;
};

export const parseAddress = (
	address: string | null,
): { road: string; city: string; state: string; zip: string } => {
	const [road = "", city = "", state = "", zip = ""] = (address ?? "").split(
		"\n",
	);
	return { road, city, state, zip };
};
