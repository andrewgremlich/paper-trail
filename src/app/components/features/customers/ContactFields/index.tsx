import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ContactChannel } from "@/lib/db/types";
import { CONTACT_CHANNELS } from "../contactHelpers";

type Props = {
	form?: string;
	defaults?: {
		channel: ContactChannel | null;
		value: string | null;
	};
};

export const ContactFields = ({ form, defaults }: Props) => (
	<>
		<Select
			label="Contact via"
			name="contactChannel"
			form={form}
			defaultValue={defaults?.channel ?? ""}
			options={[
				{ value: "", label: "— none —" },
				...CONTACT_CHANNELS.map((c) => ({ value: c.value, label: c.label })),
			]}
		/>
		<Input
			label="Contact handle"
			name="contactValue"
			type="text"
			form={form}
			defaultValue={defaults?.value ?? ""}
			placeholder="+14155551234 or @handle"
		/>
	</>
);
