import { Save, UserPlus } from "lucide-react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import type { Customer } from "@/lib/db/types";
import { AddressFields } from "../AddressFields";
import { composeAddress, parseAddress } from "../addressHelpers";
import { ContactFields } from "../ContactFields";

type Props = {
	isOpen: boolean;
	customer?: Customer;
	onSubmit: (formData: FormData) => Promise<void>;
	onClose: () => void;
};

const HEADING_ID = "customer-dialog-heading";

export const CustomerDialog = ({
	isOpen,
	customer,
	onSubmit,
	onClose,
}: Props) => {
	const isEdit = customer != null;
	const addressDefaults = isEdit
		? parseAddress(customer.address ?? null)
		: undefined;

	return (
		<Dialog isOpen={isOpen} onClose={onClose} titleId={HEADING_ID}>
			<ModalHeader
				title={isEdit ? "Edit Customer" : "New Customer"}
				headingId={HEADING_ID}
				onClose={onClose}
				closeAriaLabel={
					isEdit ? "Close edit customer dialog" : "Close new customer dialog"
				}
			/>
			<Grid
				as="form"
				cols={2}
				alignItems="end"
				gap={12}
				onSubmit={async (evt) => {
					evt.preventDefault();
					const form = evt.currentTarget as HTMLFormElement;
					const fd = new FormData(form);
					if (isEdit) fd.set("id", String(customer.id));
					fd.set("address", composeAddress(fd) ?? "");
					await onSubmit(fd);
				}}
			>
				<Input
					label="Name"
					name="name"
					type="text"
					defaultValue={customer?.name ?? ""}
					required
				/>
				<Input
					label="Email"
					name="email"
					type="email"
					defaultValue={customer?.email ?? ""}
					required
				/>
				<AddressFields defaults={addressDefaults} />
				<ContactFields
					defaults={{
						channel: customer?.contactChannel ?? null,
						value: customer?.contactValue ?? null,
					}}
				/>
				<Button
					type="submit"
					variant="default"
					size="sm"
					leftIcon={isEdit ? <Save size={16} /> : <UserPlus size={16} />}
				>
					{isEdit ? "Save Changes" : "Add Customer"}
				</Button>
			</Grid>
		</Dialog>
	);
};
