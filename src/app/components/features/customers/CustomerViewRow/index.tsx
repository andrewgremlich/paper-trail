import { Edit, Mail, Trash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TD, TR } from "@/components/ui/Table";
import type { Customer } from "@/lib/db/types";
import { parseAddress } from "../addressHelpers";
import { consentBadge } from "../consentBadge";

type Props = {
	customer: Customer;
	isRequestingConsent: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onRequestConsent: (id: string) => void;
};

export const CustomerViewRow = ({
	customer: c,
	isRequestingConsent,
	onEdit,
	onDelete,
	onRequestConsent,
}: Props) => {
	const { road, city, state, zip } = parseAddress(c.address ?? null);

	return (
		<TR>
			<TD>{c.name}</TD>
			<TD>{c.email}</TD>
			<TD>
				<div>{road}</div>
				<div>{[city, state, zip].filter(Boolean).join(", ")}</div>
			</TD>
			<TD>
				{consentBadge(c)}
				{!c.consentToEmailInvoices && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={() => onRequestConsent(c.id)}
						disabled={isRequestingConsent}
						leftIcon={<Mail size={14} />}
						style={{ marginLeft: "0.5rem" }}
						aria-label={
							c.consentRequestedAt
								? "Resend consent request"
								: "Request consent"
						}
					>
						{c.consentRequestedAt ? "Resend" : "Request"}
					</Button>
				)}
			</TD>
			<TD>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onEdit}
					aria-label="Edit customer"
				>
					<Edit />
				</Button>
			</TD>
			<TD>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onDelete}
					aria-label="Delete customer"
				>
					<Trash />
				</Button>
			</TD>
		</TR>
	);
};
