import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { H1, Main } from "@/components/layout/HtmlElements";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getAllCustomers, getAllInvoices } from "@/lib/stripeApi";

export const Invoices = () => {
	const [selectedCustomerId, setSelectedCustomerId] = useState("");

	const [{ data: invoices, isLoading: invoicesLoading }, { data: customers }] =
		useQueries({
			queries: [
				{
					queryKey: ["invoices"],
					queryFn: async () => getAllInvoices({ max: 100 }),
				},
				{ queryKey: ["customers"], queryFn: () => getAllCustomers(50) },
			],
		});

	const filteredInvoices = selectedCustomerId
		? invoices?.filter((i) => i.customer === selectedCustomerId)
		: invoices;

	return (
		<Main>
			<H1>Invoices</H1>
			{(customers?.length ?? 0) > 1 && (
				<Select
					name="customerId"
					label="Customer"
					value={selectedCustomerId}
					onChange={(e) => setSelectedCustomerId(e.target.value)}
					options={[{ value: "", label: "All customers" }].concat(
						customers?.map((customer) => ({
							value: customer.id,
							label: `${customer.name} (${customer.email})`,
						})) ?? [],
					)}
				/>
			)}
			<Table>
				<THead>
					<TR>
						<TH>Invoice Number</TH>
						<TH>Customer Email</TH>
						<TH>Amount Due</TH>
						<TH>Currency</TH>
						<TH>Status</TH>
						<TH>Created</TH>
					</TR>
				</THead>
				<TBody>
					{invoicesLoading && (
						<TR>
							<TD colSpan={6}>Loading invoices...</TD>
						</TR>
					)}
					{(filteredInvoices?.length ?? 0) > 0 &&
						filteredInvoices?.map((i) => (
							<TR key={i.id}>
								<TD>{i.number || "N/A"}</TD>
								<TD>{i.customerEmail}</TD>
								<TD>{(i.amountDue / 100).toFixed(2)}</TD>
								<TD>{i.currency.toUpperCase()}</TD>
								<TD>{i.status}</TD>
								<TD>{new Date(i.created * 1000).toLocaleDateString()}</TD>
							</TR>
						))}
				</TBody>
			</Table>
		</Main>
	);
};
