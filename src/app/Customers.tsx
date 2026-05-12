import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { CreateCustomer } from "./components/features/customers/CreateCustomer";
import { CustomerDialog } from "./components/features/customers/CustomerDialog";
import { CustomerViewRow } from "./components/features/customers/CustomerViewRow";
import { Flex } from "./components/layout/Flex";
import { H1, Main, P } from "./components/layout/HtmlElements";
import { Button } from "./components/ui/Button";
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
	const [creating, setCreating] = useState(false);

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

	const { mutateAsync: create } = useMutation({
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
		onSuccess: async () => {
			await invalidate();
			setCreating(false);
		},
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
		onSuccess: invalidate,
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

	const hasCustomers = customers && customers.length > 0;

	return (
		<Main>
			<Flex justify="between" items="center" style={{ marginBottom: "1.5rem" }}>
				<H1 style={{ margin: 0 }}>Customers</H1>
				{hasCustomers && (
					<Button
						type="button"
						variant="default"
						leftIcon={<UserPlus size={16} />}
						onClick={() => setCreating(true)}
					>
						New Customer
					</Button>
				)}
			</Flex>

			{hasCustomers ? (
				<>
					<CustomerDialog
						isOpen={creating}
						onSubmit={create}
						onClose={() => setCreating(false)}
					/>
					<Table>
						<THead>
							<TR>
								<TH>Name</TH>
								<TH>Email</TH>
								<TH>Address</TH>
								<TH>Actions</TH>
							</TR>
						</THead>
						<TBody>
							{customers.map((c) => (
								<CustomerViewRow
									key={c.id}
									customer={c}
									isRequestingConsent={isRequestingConsent}
									onSave={save}
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
							))}
						</TBody>
					</Table>
				</>
			) : (
				<CreateCustomer onSubmit={create} />
			)}
		</Main>
	);
};
