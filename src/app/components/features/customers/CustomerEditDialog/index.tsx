import { Save } from "lucide-react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import type { Customer } from "@/lib/db/types";
import { AddressFields } from "../AddressFields";
import { composeAddress, parseAddress } from "../addressHelpers";

type Props = {
	customer: Customer;
	onSave: (formData: FormData) => Promise<void>;
	onClose: () => void;
};

export const CustomerEditDialog = ({ customer: c, onSave, onClose }: Props) => {
	const headingId = `edit-customer-${c.id}`;
	const addressDefaults = parseAddress(c.address ?? null);

	return (
		<Dialog isOpen onClose={onClose} titleId={headingId}>
			<ModalHeader
				title="Edit Customer"
				headingId={headingId}
				onClose={onClose}
				closeAriaLabel="Close edit customer dialog"
			/>
			<Grid
				as="form"
				cols={2}
				gap={12}
				alignItems="end"
				onSubmit={async (evt) => {
					evt.preventDefault();
					const fd = new FormData(evt.currentTarget as HTMLFormElement);
					fd.set("id", String(c.id));
					fd.set("address", composeAddress(fd) ?? "");
					await onSave(fd);
				}}
			>
				<Input label="Name" name="name" defaultValue={c.name} required />
				<Input
					label="Email"
					name="email"
					type="email"
					defaultValue={c.email}
					required
				/>
				<AddressFields defaults={addressDefaults} />
				<Button
					type="submit"
					variant="default"
					size="sm"
					leftIcon={<Save size={16} />}
					style={{ gridColumn: "1 / -1" }}
				>
					Save Changes
				</Button>
			</Grid>
		</Dialog>
	);
};
