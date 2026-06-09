import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle,
	ExternalLink,
	Link as LinkIcon,
	Mail,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/db/client";
import {
	markInvoicePaid,
	openInvoicePreview,
	publishInvoice,
	rotateInvoiceLink,
	sendInvoice,
	voidInvoice,
} from "@/lib/db/invoices";
import type { Invoice } from "@/lib/db/types";
import styles from "./styles.module.css";

const isTerminal = (status: Invoice["status"]) =>
	status === "paid" || status === "void";

export const PayVoidButtons = ({ invoice }: { invoice: Invoice }) => {
	const queryClient = useQueryClient();
	const [sendError, setSendError] = useState<string | null>(null);
	const [payError, setPayError] = useState<string | null>(null);
	const [voidError, setVoidError] = useState<string | null>(null);
	const [publishError, setPublishError] = useState<string | null>(null);
	const [copyError, setCopyError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	// The tokened public URL (/invoice/<id>?t=<token>), captured from the
	// publish/send response. This is the link a recipient needs — the
	// token gates access and the first visit strips it from the URL. The
	// token is never stored on the Invoice object (it's a secret), so it's
	// only available here after a publish/send this session.
	const [tokenedUrl, setTokenedUrl] = useState<string | null>(null);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] });
		queryClient.invalidateQueries({ queryKey: ["invoices"] });
		queryClient.invalidateQueries({ queryKey: ["invoice-by-timesheet"] });
	};

	const { mutateAsync: send, isPending: isSending } = useMutation({
		mutationFn: () => sendInvoice(invoice.id),
		onSuccess: (res) => {
			if (res.hostedUrl) setTokenedUrl(res.hostedUrl);
			invalidate();
		},
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

	const { mutate: publish, isPending: isPublishing } = useMutation({
		mutationFn: () => publishInvoice(invoice.id),
		onSuccess: (res) => {
			if (res.hostedUrl) setTokenedUrl(res.hostedUrl);
			invalidate();
		},
		onError: (e) =>
			setPublishError(e instanceof Error ? e.message : "Failed to publish"),
	});

	const { mutate: rotateLink, isPending: isRotating } = useMutation({
		mutationFn: () => rotateInvoiceLink(invoice.id),
		onSuccess: async (res) => {
			setCopyError(null);
			if (res.hostedUrl) {
				setTokenedUrl(res.hostedUrl);
				try {
					await navigator.clipboard.writeText(res.hostedUrl);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					window.prompt("Copy this link:", res.hostedUrl);
				}
			}
			invalidate();
		},
		onError: (e) =>
			setCopyError(e instanceof Error ? e.message : "Failed to refresh link"),
	});

	const { mutate: voidIt, isPending: isVoiding } = useMutation({
		mutationFn: () => voidInvoice(invoice.id),
		onSuccess: invalidate,
		onError: (e) =>
			setVoidError(e instanceof Error ? e.message : "Failed to void invoice"),
	});

	// Bare URL (no token) — the operator can open it because they hold the
	// path-scoped cookie, but a fresh recipient cannot. Used only as the
	// preview fallback target below.
	const hostedUrl = `${window.location.origin}/invoice/${invoice.id}`;

	const copyPublicUrl = async () => {
		// Only the tokened link works for a recipient. If we don't have one
		// this session, tell the operator to (re)publish/send to mint a fresh
		// token rather than copy a link that 404s for the recipient.
		if (!tokenedUrl) {
			setCopyError(
				invoice.status === "draft"
					? "Publish or send first to generate a shareable link."
					: "Re-publish or re-send to generate a fresh shareable link.",
			);
			return;
		}
		setCopyError(null);
		try {
			await navigator.clipboard.writeText(tokenedUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			window.prompt("Copy this link:", tokenedUrl);
		}
	};

	return (
		<>
			<Flex gap={8} className={styles.buttonContainer} wrap="wrap">
				<Flex gap={8}>
					{(invoice.status === "draft" || invoice.status === "published") && (
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
					{invoice.status === "draft" && (
						<Button
							size="sm"
							variant="secondary"
							onClick={() => {
								setPublishError(null);
								publish();
							}}
							isLoading={isPublishing}
							leftIcon={<CheckCircle size={16} />}
						>
							Publish
						</Button>
					)}
					<Button
						size="sm"
						variant="secondary"
						onClick={copyPublicUrl}
						leftIcon={<LinkIcon size={16} />}
					>
						{copied ? "Copied" : "Copy public URL"}
					</Button>
					{(invoice.status === "published" ||
						invoice.status === "sent" ||
						invoice.status === "paid") && (
						<Button
							size="sm"
							variant="secondary"
							onClick={() => {
								setCopyError(null);
								rotateLink();
							}}
							isLoading={isRotating}
							leftIcon={<RefreshCw size={16} />}
						>
							Refresh link
						</Button>
					)}
					<Button
						size="sm"
						variant="secondary"
						onClick={() => {
							openInvoicePreview(invoice.id).catch(() => {
								window.open(hostedUrl, "_blank");
							});
						}}
						leftIcon={<ExternalLink size={16} />}
					>
						Open invoice page
					</Button>
				</Flex>
				<Flex gap={8}>
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
			</Flex>
			{sendError && <P className={styles.error}>{sendError}</P>}
			{payError && <P className={styles.error}>{payError}</P>}
			{voidError && <P className={styles.error}>{voidError}</P>}
			{publishError && <P className={styles.error}>{publishError}</P>}
			{copyError && <P className={styles.error}>{copyError}</P>}
			{tokenedUrl && (
				<P>
					Shareable link copied with its access token — anyone with it can view
					and pay. Refreshing the link invalidates any previously shared link.
				</P>
			)}
			{invoice.status === "published" && <P>Invoice has been published.</P>}
			{invoice.status === "sent" && <P>Invoice has been sent.</P>}
			{invoice.status === "paid" && <P>Invoice has been marked as paid.</P>}
			{invoice.status === "void" && <P>Invoice has been voided.</P>}
		</>
	);
};
