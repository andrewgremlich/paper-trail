import { Save } from "lucide-react";
import { useRef, useState } from "react";
import { ModalHeader } from "@/components/shared/ModalHeader";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Project, Transaction } from "@/lib/db";
import {
	openAttachment,
	removeAttachment,
	saveAttachment,
} from "@/lib/files/fileStorage";
import styles from "./styles.module.css";

const HEADING_ID = "transaction-dialog-heading";

interface TransactionDialogProps {
	isOpen: boolean;
	tx: Transaction;
	projects: Project[] | undefined;
	onSave: (formData: FormData) => Promise<void>;
	onClose: () => void;
}

export const TransactionDialog = ({
	isOpen,
	tx,
	projects,
	onSave,
	onClose,
}: TransactionDialogProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [clearFile, setClearFile] = useState(false);

	const path = tx.filePath ?? "";
	const effectivePath = clearFile ? "" : path;
	const hasExistingFile = effectivePath.length > 0;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setPendingFile(file);
			setClearFile(false);
		}
	};

	const handleRemoveFile = () => {
		setPendingFile(null);
		setClearFile(true);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleClose = () => {
		setPendingFile(null);
		setClearFile(false);
		onClose();
	};

	return (
		<Dialog isOpen={isOpen} onClose={handleClose} titleId={HEADING_ID}>
			<ModalHeader
				title="Edit Transaction"
				headingId={HEADING_ID}
				onClose={handleClose}
				closeAriaLabel="Close edit transaction dialog"
			/>
			<Grid
				as="form"
				cols={2}
				alignItems="end"
				gap={12}
				onSubmit={async (evt) => {
					evt.preventDefault();
					const fd = new FormData(evt.currentTarget as HTMLFormElement);
					fd.set("id", String(tx.id));

					if (pendingFile) {
						if (path) await removeAttachment(path);
						const newKey = await saveAttachment(pendingFile);
						fd.set("filePath", newKey);
					} else if (clearFile && path) {
						await removeAttachment(path);
						fd.set("filePath", "");
					} else {
						fd.set("filePath", path);
					}

					await onSave(fd);
				}}
			>
				<Input
					label="Date"
					name="date"
					type="date"
					defaultValue={tx.date}
					required
				/>
				<Input
					label="Description"
					name="description"
					type="text"
					defaultValue={tx.description}
					required
				/>
				<Select
					label="Project"
					name="projectId"
					defaultValue={tx.projectId ?? ""}
					options={projects?.map((p) => ({ value: p.id, label: p.name })) ?? []}
				/>
				<Input
					label="Amount"
					name="amount"
					type="number"
					step="0.01"
					defaultValue={tx.amount.toFixed(2)}
					required
				/>
				<div className={styles.fileSection}>
					<span className={styles.fileLabel}>File</span>
					{pendingFile ? (
						<div className={styles.fileRow}>
							<span className={styles.fileName}>{pendingFile.name}</span>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={handleRemoveFile}
								aria-label="Remove selected file"
							>
								Remove
							</Button>
						</div>
					) : hasExistingFile ? (
						<div className={styles.fileRow}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={async () => openAttachment(effectivePath)}
							>
								View File
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Replace file"
							>
								Replace
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={handleRemoveFile}
								aria-label="Remove file"
							>
								Remove
							</Button>
						</div>
					) : (
						<div className={styles.fileRow}>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Upload file"
							>
								Upload
							</Button>
						</div>
					)}
					<input
						ref={fileInputRef}
						type="file"
						className={styles.hiddenInput}
						onChange={handleFileChange}
						aria-label="Select file"
					/>
				</div>
				<Button
					type="submit"
					variant="default"
					size="sm"
					leftIcon={<Save size={16} />}
				>
					Save Changes
				</Button>
			</Grid>
		</Dialog>
	);
};
