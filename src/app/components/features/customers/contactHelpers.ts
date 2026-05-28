import type { ContactChannel, Customer } from "@/lib/db/types";

export const CONTACT_CHANNELS: { value: ContactChannel; label: string }[] = [
	{ value: "phone", label: "Phone" },
	{ value: "sms", label: "SMS" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "telegram", label: "Telegram" },
	{ value: "signal", label: "Signal" },
	{ value: "discord", label: "Discord" },
];

const VALID_CHANNELS = new Set<ContactChannel>(
	CONTACT_CHANNELS.map((c) => c.value),
);

const isContactChannel = (value: string): value is ContactChannel =>
	VALID_CHANNELS.has(value as ContactChannel);

export type ContactInput = {
	contactChannel: ContactChannel | null;
	contactValue: string | null;
};

export const readContactFields = (fd: FormData): ContactInput => {
	const channelRaw = String(fd.get("contactChannel") ?? "").trim();
	const value = String(fd.get("contactValue") ?? "").trim();
	if (!channelRaw || !value || !isContactChannel(channelRaw)) {
		return { contactChannel: null, contactValue: null };
	}
	return { contactChannel: channelRaw, contactValue: value };
};

/**
 * Build a `tel:`/`sms:`/`wa.me/…` URL for channels that have a native
 * deep link. Returns null for handle-based channels (Telegram, Signal,
 * Discord) where there's no universal join URL — the UI renders the
 * handle as plain text instead.
 */
export const contactDeepLink = (
	c: Pick<Customer, "contactChannel" | "contactValue">,
): string | null => {
	const channel = c.contactChannel;
	const value = c.contactValue;
	if (!channel || !value) return null;
	const digits = value.replace(/[^\d+]/g, "");
	switch (channel) {
		case "phone":
			return digits ? `tel:${digits}` : null;
		case "sms":
			return digits ? `sms:${digits}` : null;
		case "whatsapp":
			return digits ? `https://wa.me/${digits.replace(/^\+/, "")}` : null;
		default:
			return null;
	}
};

export const contactChannelLabel = (channel: ContactChannel): string =>
	CONTACT_CHANNELS.find((c) => c.value === channel)?.label ?? channel;
