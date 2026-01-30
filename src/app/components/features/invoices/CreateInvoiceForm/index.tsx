import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { usePaperTrailStore } from "@/lib/store";
import { createOneOffInvoice, getAllCustomers } from "@/lib/stripeApi";
import styles from "./styles.module.css";

export const CreateInvoiceForm = () => {
	const { toggleInvoiceModal } = usePaperTrailStore();
	const queryClient = useQueryClient();
	const [customerId, setCustomerId] = useState("");
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");

	const { data: customers, isLoading: customersLoading } = useQuery({
		queryKey: ["stripe-customers"],
		queryFn: () => getAllCustomers(),
	});

	const {
		mutate: createInvoice,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: createOneOffInvoice,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["invoices"] });
			toggleInvoiceModal();
		},
	});

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const amountCents = Math.round(parseFloat(amount) * 100);
		createInvoice({
			customerId,
			amountCents,
			description: description || undefined,
		});
	};

	const customerOptions =
		customers?.map((c) => ({
			value: c.id,
			label: c.name || c.email || c.id,
		})) ?? [];

	return (
		<form onSubmit={handleSubmit} className={styles.form}>
			<Flex direction="col" gap={16}>
				<P>Generate a one-time invoice for your customers.</P>

				<Select
					label="Customer"
					name="customerId"
					required
					value={customerId}
					onChange={(e) => setCustomerId(e.target.value)}
					disabled={customersLoading || isPending}
					options={[
						{ value: "", label: "Select a customer...", disabled: true },
						...customerOptions,
					]}
				/>

				<Input
					label="Amount ($)"
					name="amount"
					type="number"
					min="0.01"
					step="0.01"
					required
					placeholder="0.00"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					disabled={isPending}
				/>

				<Textarea
					label="Description"
					name="description"
					placeholder="Invoice description (optional)"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					disabled={isPending}
					rows={4}
				/>

				{isError && (
					<P className={styles.errorMessage}>
						Error: {error instanceof Error ? error.message : "Unknown error"}
					</P>
				)}

				<Flex gap={12} justify="end">
					<Button
						type="button"
						variant="secondary"
						onClick={() => toggleInvoiceModal()}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="default"
						disabled={!customerId || !amount || isPending}
						isLoading={isPending}
					>
						Create Invoice
					</Button>
				</Flex>
			</Flex>
		</form>
	);
};
