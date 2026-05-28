import {
	Download,
	FileCheck,
	Save,
	TrashIcon,
	Unlink,
	XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { Flex } from "@/components/layout/Flex";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import type { Attachment, AttachmentStatus } from "@/lib/db/types";

const STATUS_LABELS: Record<AttachmentStatus, ReactNode> = {
	attached: (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
			<FileCheck size={16} aria-hidden="true" /> Attached
		</span>
	),
	orphaned: (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
			<Unlink size={16} aria-hidden="true" /> Orphaned — will auto-delete
		</span>
	),
	pending: (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
			<XCircle size={16} aria-hidden="true" /> Upload abandoned
		</span>
	),
};

type Props = {
	attachment: Attachment | null;
	isRenaming: boolean;
	isRemoving: boolean;
	onClose: () => void;
	onRename: (name: string) => void;
	onDownload: () => void;
	onDelete: () => void;
};

export const FileActionsDialog = ({
	attachment: att,
	isRenaming,
	isRemoving,
	onClose,
	onRename,
	onDownload,
	onDelete,
}: Props) => {
	const headingId = att ? `file-actions-${att.id}` : "file-actions-empty";

	return (
		<Dialog isOpen={att !== null} onClose={onClose} titleId={headingId}>
			{att && (
				<>
					<ModalHeader
						title="File"
						headingId={headingId}
						onClose={onClose}
						closeAriaLabel="Close file actions dialog"
					/>
					<div
						style={{ margin: "0.5rem 0 1rem", color: "var(--text-secondary)" }}
					>
						{STATUS_LABELS[att.status]}
					</div>
					<Grid
						key={att.id}
						as="form"
						cols={1}
						gap={12}
						onSubmit={(evt) => {
							evt.preventDefault();
							const fd = new FormData(evt.currentTarget as HTMLFormElement);
							const name = String(fd.get("name") ?? "").trim();
							if (!name || name === att.originalName) {
								onClose();
								return;
							}
							onRename(name);
						}}
					>
						<Input
							label="Name"
							name="name"
							defaultValue={att.originalName}
							required
							autoFocus
						/>
						<Flex justify="between" items="center" gap={8}>
							<Flex gap={8}>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={onDownload}
									leftIcon={<Download size={16} />}
									aria-label={`Download ${att.originalName}`}
								>
									Download
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={isRemoving}
									onClick={onDelete}
									leftIcon={<TrashIcon size={16} />}
									aria-label={`Delete ${att.originalName}`}
								>
									Delete
								</Button>
							</Flex>
							<Button
								type="submit"
								variant="default"
								size="sm"
								disabled={isRenaming}
								leftIcon={<Save size={16} />}
							>
								{isRenaming ? "Saving..." : "Save"}
							</Button>
						</Flex>
					</Grid>
				</>
			)}
		</Dialog>
	);
};
