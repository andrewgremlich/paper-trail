import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TD, TR } from "@/components/ui/Table";
import type { Customer } from "@/lib/db/types";
import { AddressFields } from "../AddressFields";
import { composeAddress, parseAddress } from "../addressHelpers";
import { consentBadge } from "../consentBadge";

type Props = {
	customer: Customer;
	onSave: (formData: FormData) => Promise<void>;
	onCancel: () => void;
};

export const CustomerEditRow = ({ customer: c, onSave, onCancel }: Props) => {
	const formId = `cust-edit-${c.id}`;
	const addressDefaults = parseAddress(c.address ?? null);

	return (
		<TR>
			<TD>
				<Input
					name="name"
					defaultValue={c.name}
					form={formId}
					required
					aria-label="Name"
				/>
			</TD>
			<TD>
				<Input
					name="email"
					type="email"
					defaultValue={c.email}
					form={formId}
					required
					aria-label="Email"
				/>
			</TD>
			<TD>
				<AddressFields form={formId} defaults={addressDefaults} />
			</TD>
			<TD>{consentBadge(c)}</TD>
			<TD>
				<form
					id={formId}
					onSubmit={async (evt) => {
						evt.preventDefault();
						const fd = new FormData(evt.currentTarget);
						fd.set("id", String(c.id));
						fd.set("address", composeAddress(fd) ?? "");
						await onSave(fd);
					}}
				>
					<Button
						type="submit"
						size="sm"
						variant="ghost"
						aria-label="Save changes"
					>
						<Save />
					</Button>
				</form>
			</TD>
			<TD>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onCancel}
					aria-label="Cancel editing"
				>
					<X />
				</Button>
			</TD>
		</TR>
	);
};
