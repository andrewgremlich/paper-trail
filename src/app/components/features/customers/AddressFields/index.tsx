import { useState } from "react";
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

export const AddressFields = ({ form, defaults }: Props) => {
	const [values, setValues] = useState({
		road: defaults?.road ?? "",
		city: defaults?.city ?? "",
		state: defaults?.state ?? "",
		zip: defaults?.zip ?? "",
	});

	const anyFilled = Object.values(values).some((v) => v.trim().length > 0);

	const handleChange =
		(field: keyof typeof values) =>
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValues((prev) => ({ ...prev, [field]: e.target.value }));
		};

	return (
		<>
			<Input
				label="Street address"
				name="road"
				type="text"
				form={form}
				value={values.road}
				onChange={handleChange("road")}
				required={anyFilled}
				aria-label="Street address"
			/>
			<Input
				label="City"
				name="city"
				type="text"
				form={form}
				value={values.city}
				onChange={handleChange("city")}
				required={anyFilled}
				aria-label="City"
			/>
			<Input
				label="State"
				name="state"
				type="text"
				form={form}
				value={values.state}
				onChange={handleChange("state")}
				required={anyFilled}
				aria-label="State"
			/>
			<Input
				label="ZIP code"
				name="zip"
				type="text"
				form={form}
				value={values.zip}
				onChange={handleChange("zip")}
				required={anyFilled}
				aria-label="ZIP code"
			/>
		</>
	);
};
