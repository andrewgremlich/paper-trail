import { Edit, Mail, Trash, X } from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { Button } from "@/components/ui/Button";
import { TD, TR } from "@/components/ui/Table";
import type { Customer } from "@/lib/db/types";
import { parseAddress } from "../addressHelpers";
import { CustomerDialog } from "../CustomerDialog";
import { contactChannelLabel, contactDeepLink } from "../contactHelpers";

type Props = {
	customer: Customer;
	isRequestingConsent: boolean;
	isRevokingConsent: boolean;
	onSave: (formData: FormData) => Promise<void>;
	onDelete: () => void;
	onRequestConsent: (id: string) => void;
	onRevokeConsent: (id: string) => void;
};

export const CustomerViewRow = ({
	customer: c,
	isRequestingConsent,
	isRevokingConsent,
	onSave,
	onDelete,
	onRequestConsent,
	onRevokeConsent,
}: Props) => {
	const [editing, setEditing] = useState(false);
	const { road, city, state, zip } = parseAddress(c.address ?? null);
	const contactHref = contactDeepLink(c);

	return (
		<>
			<TR>
				<TD>{c.name}</TD>
				<TD>{c.email}</TD>
				<TD>
					<div>{road}</div>
					<div>{[city, state, zip].filter(Boolean).join(", ")}</div>
				</TD>
				<TD>
					{c.contactChannel && c.contactValue ? (
						<div>
							<div
								style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}
							>
								{contactChannelLabel(c.contactChannel)}
							</div>
							{contactHref ? (
								<a href={contactHref}>{c.contactValue}</a>
							) : (
								<span>{c.contactValue}</span>
							)}
						</div>
					) : (
						<span style={{ color: "var(--text-secondary)" }}>—</span>
					)}
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
					{c.consentToEmailInvoices && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => {
								if (window.confirm(`Revoke email consent for ${c.name}?`)) {
									onRevokeConsent(c.id);
								}
							}}
							disabled={isRevokingConsent}
							leftIcon={<X size={20} />}
							aria-label="Revoke consent"
						>
							Revoke
						</Button>
					)}
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
