import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Mail, Save, Trash, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { H1, Main, P } from "./components/layout/HtmlElements";
import { Button } from "./components/ui/Button";
import { Grid } from "./components/ui/Grid";
import { Input } from "./components/ui/Input";
import { Table, TBody, TD, TH, THead, TR } from "./components/ui/Table";
import { Textarea } from "./components/ui/Textarea";
import {
	createCustomer,
	deleteCustomer,
	getCustomers,
	requestConsent,
	updateCustomer,
} from "./lib/db/customers";
import type { Customer } from "./lib/db/types";

const consentBadge = (c: Customer): string => {
	if (c.consentToEmailInvoices) {
		return c.consentedAt
			? `Consented ${c.consentedAt.slice(0, 10)}`
			: "Consented";
	}
	if (c.consentRequestedAt) {
		return `Requested ${c.consentRequestedAt.slice(0, 10)}`;
	}
	return "Not requested";
};

export const Customers = () => {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<number | null>(null);

	const {
		data: customers,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["customers"],
		queryFn: getCustomers,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["customers"] });

	const { mutate: submitNew } = useMutation({
		mutationFn: async (formData: FormData) => {
			const name = String(formData.get("name") ?? "").trim();
			const email = String(formData.get("email") ?? "").trim();
			const address = String(formData.get("address") ?? "").trim();
			await createCustomer({
				name,
				email,
				address: address.length > 0 ? address : null,
			});
		},
		onSuccess: invalidate,
		onError: (e) => console.error("Create customer failed:", e),
	});

	const { mutateAsync: save } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") ?? 0);
			const name = String(formData.get("name") ?? "").trim();
			const email = String(formData.get("email") ?? "").trim();
			const address = String(formData.get("address") ?? "").trim();
			await updateCustomer(id, {
				name,
				email,
				address: address.length > 0 ? address : null,
			});
		},
		onSuccess: async () => {
			setEditingId(null);
			await invalidate();
		},
	});

	const { mutate: remove } = useMutation({
		mutationFn: deleteCustomer,
		onSuccess: invalidate,
		onError: (e) => {
			console.error("Delete customer failed:", e);
			window.alert(
				e instanceof Error ? e.message : "Could not delete customer.",
			);
		},
	});

	const { mutate: requestConsentMutation, isPending: isRequestingConsent } =
		useMutation({
			mutationFn: requestConsent,
			onSuccess: () => {
				invalidate();
				window.alert("Consent request sent.");
			},
			onError: (e) => {
				console.error("Consent request failed:", e);
				window.alert(
					e instanceof Error ? e.message : "Could not send consent request.",
				);
			},
		});

	if (isLoading) {
		return (
			<Main>
				<H1>Customers</H1>
				<P>Loading customers...</P>
			</Main>
		);
	}
	if (error) {
		return (
			<Main>
				<H1>Customers</H1>
				<P>Error loading customers: {error.message}</P>
			</Main>
		);
	}

	return (
		<Main>
			<H1 style={{ marginBottom: "1.5rem" }}>Customers</H1>

			<Grid
				as="form"
				alignItems="end"
				gap={12}
				onSubmit={(evt) => {
					evt.preventDefault();
					const form = evt.currentTarget as HTMLFormElement;
					submitNew(new FormData(form));
					form.reset();
				}}
				style={{ marginBottom: "2rem" }}
			>
				<Input label="Name" name="name" type="text" required />
				<Input label="Email" name="email" type="email" required />
				<Textarea label="Address (optional)" name="address" rows={2} />
				<Button
					type="submit"
					variant="default"
					size="sm"
					leftIcon={<UserPlus size={16} />}
				>
					Add Customer
				</Button>
			</Grid>

			{customers && customers.length > 0 ? (
				<Table>
					<THead>
						<TR>
							<TH>Name</TH>
							<TH>Email</TH>
							<TH>Address</TH>
							<TH>Consent</TH>
							<TH>Edit</TH>
							<TH>Delete</TH>
						</TR>
					</THead>
					<TBody>
						{customers.map((c) =>
							editingId === c.id ? (
								<TR key={c.id}>
									<TD>
										<Input
											name="name"
											defaultValue={c.name}
											form={`cust-edit-${c.id}`}
											required
											aria-label="Name"
										/>
									</TD>
									<TD>
										<Input
											name="email"
											type="email"
											defaultValue={c.email}
											form={`cust-edit-${c.id}`}
											required
											aria-label="Email"
										/>
									</TD>
									<TD>
										<Textarea
											name="address"
											defaultValue={c.address ?? ""}
											form={`cust-edit-${c.id}`}
											rows={2}
											aria-label="Address"
										/>
									</TD>
									<TD>{consentBadge(c)}</TD>
									<TD>
										<form
											id={`cust-edit-${c.id}`}
											onSubmit={async (evt) => {
												evt.preventDefault();
												const fd = new FormData(evt.currentTarget);
												fd.set("id", String(c.id));
												await save(fd);
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
											onClick={() => setEditingId(null)}
											aria-label="Cancel editing"
										>
											<X />
										</Button>
									</TD>
								</TR>
							) : (
								<TR key={c.id}>
									<TD>{c.name}</TD>
									<TD>{c.email}</TD>
									<TD style={{ whiteSpace: "pre-wrap" }}>{c.address ?? ""}</TD>
									<TD>
										{consentBadge(c)}
										{!c.consentToEmailInvoices && (
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => requestConsentMutation(c.id)}
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
											onClick={() => setEditingId(c.id)}
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
											onClick={() => {
												if (
													window.confirm(
														`Delete customer ${c.name}? This is blocked if they have any invoices.`,
													)
												) {
													remove(c.id);
												}
											}}
											aria-label="Delete customer"
										>
											<Trash />
										</Button>
									</TD>
								</TR>
							),
						)}
					</TBody>
				</Table>
			) : (
				<P>No customers yet. Add one above.</P>
			)}
		</Main>
	);
};
