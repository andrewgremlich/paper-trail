import { Ban, Paperclip, Save, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TD } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import {
	openAttachment,
	removeAttachment,
	saveAttachment,
} from "@/lib/files/fileStorage";
import styles from "./styles.module.css";

interface TransactionEditRowProps {
	tx: Transaction;
	projects: Project[] | undefined;
	path: string;
	onSave: (formData: FormData) => Promise<void>;
	onCancel: () => void;
}

export const TransactionEditRow = ({
	tx,
	projects,
	path,
	onSave,
	onCancel,
}: TransactionEditRowProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [clearFile, setClearFile] = useState(false);

	const effectivePath = clearFile ? "" : path;
	const hasExistingFile = effectivePath.length > 0;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setPendingFile(file);
			setClearFile(false);
		}
	};

	const handleRemove = () => {
		setPendingFile(null);
		setClearFile(true);
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	return (
		<>
			<TD>
				<Input
					name="date"
					type="date"
					defaultValue={tx.date}
					form={`tx-edit-form-${tx.id}`}
					required
					aria-label="Date"
				/>
			</TD>
			<TD>
				<Input
					name="description"
					type="text"
					defaultValue={tx.description}
					form={`tx-edit-form-${tx.id}`}
					required
					aria-label="Description"
				/>
			</TD>
			<TD>
				<Select
					name="projectId"
					value={tx.projectId}
					options={
						projects?.map((project) => ({
							value: project.id,
							label: project.name,
						})) ?? []
					}
					form={`tx-edit-form-${tx.id}`}
					aria-label="Project"
				/>
			</TD>
			<TD>
				<Input
					name="amount"
					type="number"
					step="0.01"
					className={styles.amountInput}
					defaultValue={tx.amount.toFixed(2)}
					form={`tx-edit-form-${tx.id}`}
					required
					aria-label="Amount"
				/>
			</TD>
			<TD>
				<div className={styles.fileCell}>
					{pendingFile ? (
						<>
							<span className={styles.fileName}>{pendingFile.name}</span>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={handleRemove}
								aria-label="Remove selected file"
							>
								<X size={14} aria-hidden="true" />
							</Button>
						</>
					) : hasExistingFile ? (
						<>
							<Button
								type="button"
								variant="ghost"
								className={styles.viewFileButton}
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
								<Paperclip size={14} aria-hidden="true" />
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={handleRemove}
								aria-label="Remove file"
							>
								<X size={14} aria-hidden="true" />
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								className={styles.hiddenInput}
								onChange={handleFileChange}
								aria-label="Select replacement file"
							/>
						</>
					) : (
						<>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => fileInputRef.current?.click()}
								aria-label="Upload file"
							>
								<Paperclip size={14} aria-hidden="true" />
								Upload
							</Button>
							<input
								ref={fileInputRef}
								type="file"
								className={styles.hiddenInput}
								onChange={handleFileChange}
								aria-label="Select file"
							/>
						</>
					)}
				</div>
			</TD>
			<TD>
				<form
					id={`tx-edit-form-${tx.id}`}
					onSubmit={async (evt) => {
						evt.preventDefault();
						const fd = new FormData(evt.currentTarget);
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

						try {
							await onSave(fd);
						} catch (e) {
							console.error(e);
						}
					}}
				>
					<Button
						type="submit"
						size="sm"
						variant="ghost"
						aria-label="Save changes"
					>
						<Save />
					</Button>
				</form>
			</TD>
			<TD>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onCancel}
					aria-label="Cancel editing"
				>
					<Ban />
				</Button>
			</TD>
		</>
	);
};
