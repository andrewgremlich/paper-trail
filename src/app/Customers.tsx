import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AddCustomerForm } from "./components/features/customers/AddCustomerForm";
import { CustomerEditRow } from "./components/features/customers/CustomerEditRow";
import { CustomerViewRow } from "./components/features/customers/CustomerViewRow";
import { H1, Main, P } from "./components/layout/HtmlElements";
import { Table, TBody, TH, THead, TR } from "./components/ui/Table";
import {
	createCustomer,
	deleteCustomer,
	getCustomers,
	requestConsent,
	updateCustomer,
} from "./lib/db/customers";

export const Customers = () => {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<string | null>(null);

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
			const id = String(formData.get("id") ?? "");
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

			<AddCustomerForm onSubmit={submitNew} />

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
								<CustomerEditRow
									key={c.id}
									customer={c}
									onSave={save}
									onCancel={() => setEditingId(null)}
								/>
							) : (
								<CustomerViewRow
									key={c.id}
									customer={c}
									isRequestingConsent={isRequestingConsent}
									onEdit={() => setEditingId(c.id)}
									onDelete={() => {
										if (
											window.confirm(
												`Delete customer ${c.name}? This is blocked if they have any invoices.`,
											)
										) {
											remove(c.id);
										}
									}}
									onRequestConsent={requestConsentMutation}
								/>
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
