import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import { AddressFields } from "../AddressFields";
import { composeAddress } from "../addressHelpers";

type Props = {
	onSubmit: (formData: FormData) => void;
};

export const AddCustomerForm = ({ onSubmit }: Props) => (
	<Grid
		as="form"
		alignItems="end"
		cols={2}
		gap={12}
		onSubmit={(evt) => {
			evt.preventDefault();
			const form = evt.currentTarget as HTMLFormElement;
			const fd = new FormData(form);
			const address = composeAddress(fd);
			fd.set("address", address ?? "");
			onSubmit(fd);
			form.reset();
		}}
		style={{ marginBottom: "2rem" }}
	>
		<Input label="Name" name="name" type="text" required />
		<Input label="Email" name="email" type="email" required />
		<AddressFields />
		<Button
			type="submit"
			variant="default"
			size="sm"
			leftIcon={<UserPlus size={16} />}
		>
			Add Customer
		</Button>
	</Grid>
);
