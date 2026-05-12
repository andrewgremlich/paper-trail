import type { Customer } from "@/lib/db/types";

export const consentBadge = (c: Customer): string => {
	if (c.consentToEmailInvoices) {
		return c.consentedAt
			? `Consented ${c.consentedAt.slice(0, 10)}`
			: "Consented";
	}
	if (c.consentRequestedAt) {
		return `Requested ${c.consentRequestedAt.slice(0, 10)}`;
	}
	return "Not requested";
};
