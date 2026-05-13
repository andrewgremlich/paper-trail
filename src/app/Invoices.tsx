import { useQueries } from "@tanstack/react-query";
import { NotebookPen } from "lucide-react";
import { useMemo, useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { H1, Main } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { getCustomers } from "@/lib/db/customers";
import { getInvoices } from "@/lib/db/invoices";
import type { InvoiceStatus } from "@/lib/db/types";
import { usePaperTrailStore } from "./lib/store";

const formatCents = (cents: number): string =>
	(cents / 100).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});

const statusLabel = (status: InvoiceStatus): string =>
	status[0].toUpperCase() + status.slice(1);

export const Invoices = () => {
	const { openModal } = usePaperTrailStore();
	const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
	const [selectedStatus, setSelectedStatus] = useState<string>("");

	const [{ data: invoices, isLoading: invoicesLoading }, { data: customers }] =
		useQueries({
			queries: [
				{
					queryKey: ["invoices"],
					queryFn: () => getInvoices(),
				},
				{ queryKey: ["customers"], queryFn: getCustomers },
			],
		});

	const customerById = useMemo(() => {
		const map = new Map<string, string>();
		for (const c of customers ?? []) map.set(c.id, c.name);
		return map;
	}, [customers]);

	const filtered = useMemo(() => {
		let list = invoices ?? [];
		if (selectedCustomerId) {
			list = list.filter((i) => i.customerId === selectedCustomerId);
		}
		if (selectedStatus) {
			list = list.filter((i) => i.status === selectedStatus);
		}
		return list;
	}, [invoices, selectedCustomerId, selectedStatus]);

	return (
		<Main>
			<Flex justify="between" items="center" style={{ marginBottom: "1.5rem" }}>
				<H1 style={{ marginBottom: "0px" }}>Invoices</H1>
				<Button
					type="button"
					onClick={() => openModal({ type: "invoice" })}
					leftIcon={<NotebookPen size={16} />}
				>
					Generate Invoice
				</Button>
			</Flex>
			<Flex gap={12} style={{ marginBottom: "1rem" }}>
				{(customers?.length ?? 0) > 1 && (
					<Select
						name="customerId"
						label="Customer"
						value={selectedCustomerId}
						onChange={(e) => setSelectedCustomerId(e.target.value)}
						options={[{ value: "", label: "All customers" }].concat(
							customers?.map((c) => ({
								value: String(c.id),
								label: `${c.name} (${c.email})`,
							})) ?? [],
						)}
					/>
				)}
				<Select
					name="status"
					label="Status"
					value={selectedStatus}
					onChange={(e) => setSelectedStatus(e.target.value)}
					options={[
						{ value: "", label: "All statuses" },
						{ value: "draft", label: "Draft" },
						{ value: "sent", label: "Sent" },
						{ value: "paid", label: "Paid" },
						{ value: "void", label: "Void" },
					]}
				/>
			</Flex>
			<Table>
				<THead>
					<TR>
						<TH>Number</TH>
						<TH>Customer</TH>
						<TH>Amount</TH>
						<TH>Status</TH>
						<TH>Issued</TH>
						<TH>Due</TH>
					</TR>
				</THead>
				<TBody>
					{invoicesLoading && (
						<TR>
							<TD colSpan={6}>Loading invoices…</TD>
						</TR>
					)}
					{filtered.length === 0 && !invoicesLoading && (
						<TR>
							<TD colSpan={6}>No invoices match.</TD>
						</TR>
					)}
					{filtered.map((i) => (
						<TR
							key={i.id}
							style={{ cursor: "pointer" }}
							onClick={() => openModal({ type: "invoice", invoiceId: i.id })}
						>
							<TD>{i.number}</TD>
							<TD>{customerById.get(i.customerId) ?? "—"}</TD>
							<TD>{formatCents(i.amount_cents)}</TD>
							<TD>{statusLabel(i.status)}</TD>
							<TD>{i.issuedAt}</TD>
							<TD>{i.dueDate}</TD>
						</TR>
					))}
				</TBody>
			</Table>
		</Main>
	);
};
