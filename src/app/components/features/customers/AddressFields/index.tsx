import { Input } from "@/components/ui/Input";

type Props = {
	form?: string;
	defaults?: {
		road: string;
		city: string;
		state: string;
		zip: string;
	};
};

export const AddressFields = ({ form, defaults }: Props) => (
	<>
		<Input
			label="Street address"
			name="road"
			type="text"
			form={form}
			defaultValue={defaults?.road ?? ""}
			aria-label="Street address"
		/>
		<Input
			label="City"
			name="city"
			type="text"
			form={form}
			defaultValue={defaults?.city ?? ""}
			aria-label="City"
		/>
		<Input
			label="State"
			name="state"
			type="text"
			form={form}
			defaultValue={defaults?.state ?? ""}
			aria-label="State"
		/>
		<Input
			label="ZIP code"
			name="zip"
			type="text"
			form={form}
			defaultValue={defaults?.zip ?? ""}
			aria-label="ZIP code"
		/>
	</>
);
