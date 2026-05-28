import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddressFields } from "../AddressFields";
import { composeAddress } from "../addressHelpers";
import { ContactFields } from "../ContactFields";
import styles from "./styles.module.css";

type Props = {
	onSubmit: (formData: FormData) => Promise<void>;
};

export const CreateCustomer = ({ onSubmit }: Props) => (
	<form
		className={styles.form}
		onSubmit={async (e) => {
			e.preventDefault();
			const fd = new FormData(e.currentTarget);
			fd.set("address", composeAddress(fd) ?? "");
			await onSubmit(fd);
			e.currentTarget.reset();
		}}
	>
		<Input
			label="Name"
			name="name"
			type="text"
			required
			className={styles.fullWidth}
		/>
		<Input
			label="Email"
			name="email"
			type="email"
			required
			className={styles.fullWidth}
		/>
		<AddressFields />
		<ContactFields />
		<Button type="submit" variant="default" leftIcon={<UserPlus size={16} />}>
			Add Customer
		</Button>
	</form>
);
