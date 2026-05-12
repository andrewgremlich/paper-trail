import { Edit, Mail, Trash } from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { Button } from "@/components/ui/Button";
import { TD, TR } from "@/components/ui/Table";
import type { Customer } from "@/lib/db/types";
import { parseAddress } from "../addressHelpers";
import { CustomerDialog } from "../CustomerDialog";

type Props = {
	customer: Customer;
	isRequestingConsent: boolean;
	onSave: (formData: FormData) => Promise<void>;
	onDelete: () => void;
	onRequestConsent: (id: string) => void;
};

export const CustomerViewRow = ({
	customer: c,
	isRequestingConsent,
	onSave,
	onDelete,
	onRequestConsent,
}: Props) => {
	const [editing, setEditing] = useState(false);
	const { road, city, state, zip } = parseAddress(c.address ?? null);

	return (
		<>
			<TR>
				<TD>{c.name}</TD>
				<TD>{c.email}</TD>
				<TD>
					<div>{road}</div>
					<div>{[city, state, zip].filter(Boolean).join(", ")}</div>
				</TD>
				<Flex as="td">
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => onRequestConsent(c.id)}
						disabled={isRequestingConsent}
						leftIcon={<Mail size={20} />}
						style={{ marginLeft: "0.5rem" }}
						aria-label={
							c.consentRequestedAt
								? "Resend consent request"
								: "Request consent"
						}
					>
						{c.consentRequestedAt ? "Resend" : "Request"}
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => setEditing(true)}
						aria-label="Edit customer"
					>
						<Edit />
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={onDelete}
						aria-label="Delete customer"
					>
						<Trash />
					</Button>
				</Flex>
			</TR>
			<CustomerDialog
				isOpen={editing}
				customer={c}
				onSubmit={async (fd) => {
					await onSave(fd);
					setEditing(false);
				}}
				onClose={() => setEditing(false)}
			/>
		</>
	);
};
