import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { FileActionsDialog } from "./components/features/files/FileActionsDialog";
import { Flex } from "./components/layout/Flex";
import { H1, P } from "./components/layout/HtmlElements";
import { Button } from "./components/ui/Button";
import { Table, TBody, TD, TH, THead, TR } from "./components/ui/Table";
import {
	type Attachment,
	deleteAttachment,
	getAttachmentSummary,
	getAttachments,
	renameAttachment,
} from "./lib/db";
import { openAttachment } from "./lib/files/fileStorage";
import { formatDate } from "./lib/utils";

const formatBytes = (n: number): string => {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
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

	const [active, setActive] = useState<Attachment | null>(null);

	const { mutate: remove, isPending: isRemoving } = useMutation({
		mutationFn: deleteAttachment,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["attachments"] });
			setActive(null);
		},
		onError: (e) => {
			console.error("Delete attachment failed:", e);
			window.alert(
				e instanceof Error ? e.message : "Could not delete attachment.",
			);
		},
	});

	const { mutate: rename, isPending: isRenaming } = useMutation({
		mutationFn: ({ key, name }: { key: string; name: string }) =>
			renameAttachment(key, name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["attachments"] });
			setActive(null);
		},
		onError: (e) => {
			console.error("Rename attachment failed:", e);
			window.alert(
				e instanceof Error ? e.message : "Could not rename attachment.",
			);
		},
	});

	if (isLoading) {
		return (
			<main style={{ padding: "0 2rem 2rem" }}>
				<H1>Files</H1>
				<P>Loading files...</P>
			</main>
		);
	}

	if (error) {
		return (
			<main style={{ padding: "0 2rem 2rem" }}>
				<H1>Files</H1>
				<P>Error loading files: {error.message}</P>
			</main>
		);
	}

	const rows: Attachment[] = attachments ?? [];

	return (
		<main style={{ padding: "0 2rem 2rem" }}>
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
							<TH aria-label="Actions" />
						</TR>
					</THead>
					<TBody>
						{rows.map((att) => (
							<TR key={att.id}>
								<TD>{att.originalName}</TD>
								<TD>{att.contentType}</TD>
								<TD>{formatBytes(att.sizeBytes)}</TD>
								<TD>{formatDate(att.createdAt.slice(0, 10))}</TD>
								<TD>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										aria-label={`Open actions for ${att.originalName}`}
										onClick={() => setActive(att)}
									>
										<MoreHorizontal size={16} aria-hidden="true" />
									</Button>
								</TD>
							</TR>
						))}
					</TBody>
				</Table>
			)}

			<FileActionsDialog
				attachment={active}
				isRenaming={isRenaming}
				isRemoving={isRemoving}
				onClose={() => setActive(null)}
				onRename={(name) => active && rename({ key: active.id, name })}
				onDownload={() => active && openAttachment(active.id)}
				onDelete={() => {
					if (!active) return;
					const msg = active.txId
						? `Delete ${active.originalName}? It is currently attached to a transaction; the transaction will be kept but its file will be removed.`
						: `Delete ${active.originalName}?`;
					if (window.confirm(msg)) remove(active.id);
				}}
			/>
		</main>
	);
};
