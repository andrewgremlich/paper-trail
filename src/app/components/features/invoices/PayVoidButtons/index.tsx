import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link as LinkIcon, Mail } from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/db/client";
import { markInvoicePaid, sendInvoice, voidInvoice } from "@/lib/db/invoices";
import type { Invoice } from "@/lib/db/types";
import styles from "./styles.module.css";

const isTerminal = (status: Invoice["status"]) =>
	status === "paid" || status === "void";

export const PayVoidButtons = ({ invoice }: { invoice: Invoice }) => {
	const queryClient = useQueryClient();
	const [sendError, setSendError] = useState<string | null>(null);
	const [payError, setPayError] = useState<string | null>(null);
	const [voidError, setVoidError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] });
		queryClient.invalidateQueries({ queryKey: ["invoices"] });
		queryClient.invalidateQueries({ queryKey: ["invoice-by-timesheet"] });
	};

	const { mutateAsync: send, isPending: isSending } = useMutation({
		mutationFn: () => sendInvoice(invoice.id),
		onSuccess: invalidate,
		onError: (e) => {
			if (e instanceof ApiError) {
				if (e.code === "CUSTOMER_NOT_CONSENTED") {
					setSendError(
						"Customer hasn't consented yet — request consent from the Customers page first.",
					);
					return;
				}
				if (e.code === "BUSINESS_INFO_MISSING") {
					setSendError(
						"Set your business name and address in Settings before sending.",
					);
					return;
				}
				if (e.code === "DOMAIN_NOT_VERIFIED") {
					setSendError(
						"Resend can't deliver from this domain yet — see docs/EMAIL_SETUP.md.",
					);
					return;
				}
				if (e.code === "RATE_LIMITED") {
					setSendError("Send rate limit reached. Try again later.");
					return;
				}
			}
			setSendError(e instanceof Error ? e.message : "Send failed");
		},
	});

	const { mutate: pay, isPending: isPaying } = useMutation({
		mutationFn: () => markInvoicePaid(invoice.id),
		onSuccess: invalidate,
		onError: (e) =>
			setPayError(e instanceof Error ? e.message : "Failed to mark as paid"),
	});

	const { mutate: voidIt, isPending: isVoiding } = useMutation({
		mutationFn: () => voidInvoice(invoice.id),
		onSuccess: invalidate,
		onError: (e) =>
			setVoidError(e instanceof Error ? e.message : "Failed to void invoice"),
	});

	const hostedUrl = `${window.location.origin}/invoice/${invoice.id}`;

	const copyHostedUrl = async () => {
		try {
			await navigator.clipboard.writeText(hostedUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			window.prompt("Copy this link:", hostedUrl);
		}
	};

	return (
		<>
			<Flex gap={8} className={styles.buttonContainer} wrap="wrap">
				{invoice.status === "draft" && (
					<Button
						size="sm"
						onClick={() => {
							setSendError(null);
							send();
						}}
						isLoading={isSending}
						leftIcon={<Mail size={16} />}
					>
						Send invoice
					</Button>
				)}
				<Button
					size="sm"
					variant="secondary"
					onClick={copyHostedUrl}
					leftIcon={<LinkIcon size={16} />}
				>
					{copied ? "Copied" : "Copy public URL"}
				</Button>
				<Button
					size="sm"
					variant="secondary"
					onClick={() => window.open(hostedUrl, "_blank")}
					leftIcon={<ExternalLink size={16} />}
				>
					Open invoice page
				</Button>
				<Button
					size="sm"
					onClick={() => {
						setPayError(null);
						pay();
					}}
					disabled={isTerminal(invoice.status) || isPaying || isSending}
				>
					{invoice.status === "paid" ? "Already paid" : "Mark as paid"}
				</Button>
				<Button
					size="sm"
					variant="secondary"
					onClick={() => {
						setVoidError(null);
						voidIt();
					}}
					disabled={isTerminal(invoice.status) || isVoiding || isSending}
				>
					{invoice.status === "void" ? "Already voided" : "Void invoice"}
				</Button>
			</Flex>
			{sendError && <P className={styles.error}>{sendError}</P>}
			{payError && <P className={styles.error}>{payError}</P>}
			{voidError && <P className={styles.error}>{voidError}</P>}
			{invoice.status === "sent" && <P>Invoice has been sent.</P>}
			{invoice.status === "paid" && <P>Invoice has been marked as paid.</P>}
			{invoice.status === "void" && <P>Invoice has been voided.</P>}
		</>
	);
};
