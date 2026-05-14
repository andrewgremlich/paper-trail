import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { Flex } from "./components/layout/Flex";
import { H1, Main, P } from "./components/layout/HtmlElements";
import { Button } from "./components/ui/Button";
import { Table, TBody, TD, TH, THead, TR } from "./components/ui/Table";
import {
	type Attachment,
	type AttachmentStatus,
	deleteAttachment,
	getAttachmentSummary,
	getAttachments,
} from "./lib/db";
import { openAttachment } from "./lib/files/fileStorage";
import { formatDate } from "./lib/utils";

const formatBytes = (n: number): string => {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const STATUS_LABELS: Record<AttachmentStatus, string> = {
	attached: "Attached",
	orphaned: "Orphaned — will auto-delete",
	pending: "Upload abandoned",
};

export const Files = () => {
	const queryClient = useQueryClient();

	const {
		data: attachments,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["attachments"],
		queryFn: getAttachments,
	});

	const { data: summary } = useQuery({
		queryKey: ["attachments", "summary"],
		queryFn: getAttachmentSummary,
	});

	const { mutate: remove, isPending: isRemoving } = useMutation({
		mutationFn: deleteAttachment,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["attachments"] });
		},
		onError: (e) => {
			console.error("Delete attachment failed:", e);
			window.alert(
				e instanceof Error ? e.message : "Could not delete attachment.",
			);
		},
	});

	if (isLoading) {
		return (
			<Main>
				<H1>Files</H1>
				<P>Loading files...</P>
			</Main>
		);
	}

	if (error) {
		return (
			<Main>
				<H1>Files</H1>
				<P>Error loading files: {error.message}</P>
			</Main>
		);
	}

	const rows: Attachment[] = attachments ?? [];

	return (
		<Main>
			<Flex justify="between" items="center" style={{ marginBottom: "1.5rem" }}>
				<H1 style={{ margin: 0 }}>Files</H1>
				{summary && (
					<P style={{ margin: 0 }}>
						{summary.total} files · {formatBytes(summary.totalBytes)}
						{summary.orphaned > 0 ? ` · ${summary.orphaned} orphaned` : ""}
						{summary.pending > 0 ? ` · ${summary.pending} pending` : ""}
					</P>
				)}
			</Flex>

			{rows.length === 0 ? (
				<P>You haven't uploaded any files yet.</P>
			) : (
				<Table>
					<THead>
						<TR>
							<TH>Name</TH>
							<TH>Type</TH>
							<TH>Size</TH>
							<TH>Uploaded</TH>
							<TH>Status</TH>
							<TH>Actions</TH>
						</TR>
					</THead>
					<TBody>
						{rows.map((att) => (
							<TR key={att.id}>
								<TD>{att.originalName}</TD>
								<TD>{att.contentType}</TD>
								<TD>{formatBytes(att.sizeBytes)}</TD>
								<TD>{formatDate(att.createdAt.slice(0, 10))}</TD>
								<TD>{STATUS_LABELS[att.status]}</TD>
								<TD>
									<Flex>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => openAttachment(att.id)}
										>
											Download
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isRemoving}
											aria-label={`Delete ${att.originalName}`}
											onClick={() => {
												const msg = att.txId
													? `Delete ${att.originalName}? It is currently attached to a transaction; the transaction will be kept but its file will be removed.`
													: `Delete ${att.originalName}?`;
												if (window.confirm(msg)) remove(att.id);
											}}
										>
											<TrashIcon size={16} aria-hidden="true" />
										</Button>
									</Flex>
								</TD>
							</TR>
						))}
					</TBody>
				</Table>
			)}
		</Main>
	);
};
