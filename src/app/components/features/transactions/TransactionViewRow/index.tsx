import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	Edit,
	FolderOpen,
	Paperclip,
	TrashIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TD } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import {
	checkFileLink,
	openAttachment,
	saveAttachment,
} from "@/lib/files/fileStorage";
import { formatDate } from "@/lib/utils";
import { TransactionDialog } from "../TransactionDialog";
import styles from "./styles.module.css";

interface FileStatusCellProps {
	path: string;
	txId: string;
	onReplaceFile: (id: string, newPath: string) => Promise<void>;
}

const FileStatusCell = ({ path, txId, onReplaceFile }: FileStatusCellProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: isAlive } = useQuery({
		queryKey: ["file-status", path],
		queryFn: () => checkFileLink(path),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const newPath = await saveAttachment(file);
		await onReplaceFile(txId, newPath);
	};

	if (isAlive === false) {
		return (
			<div className={styles.deadLink}>
				<AlertTriangle size={14} aria-hidden="true" />
				<span className={styles.deadLinkText}>Dead link</span>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => fileInputRef.current?.click()}
					aria-label="Replace dead file link"
				>
					Replace
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					className={styles.hiddenInput}
					onChange={handleFileChange}
					aria-label="Upload replacement file"
				/>
			</div>
		);
	}

	return (
		<Button
			aria-label="Open Invoice Location"
			type="button"
			size="sm"
			variant="ghost"
			onClick={async () => {
				await openAttachment(path);
			}}
		>
			<FolderOpen size={24} aria-hidden="true" />
		</Button>
	);
};

const NoFileCell = ({
	txId,
	onReplaceFile,
}: {
	txId: string;
	onReplaceFile: (id: string, newPath: string) => Promise<void>;
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const newPath = await saveAttachment(file);
		await onReplaceFile(txId, newPath);
	};

	return (
		<div className={styles.noFile}>
			<Button
				type="button"
				size="sm"
				variant="ghost"
				leftIcon={<Paperclip size={14} aria-hidden="true" />}
				onClick={() => fileInputRef.current?.click()}
				aria-label="Upload file for this transaction"
			>
				Upload
			</Button>
			<input
				ref={fileInputRef}
				type="file"
				className={styles.hiddenInput}
				onChange={handleFileChange}
				aria-label="Upload file"
			/>
		</div>
	);
};

interface TransactionViewRowProps {
	tx: Transaction;
	projects: Project[] | undefined;
	path: string;
	onSave: (formData: FormData) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onReplaceFile: (id: string, newPath: string) => Promise<void>;
}

export const TransactionViewRow = ({
	tx,
	projects,
	path,
	onSave,
	onDelete,
	onReplaceFile,
}: TransactionViewRowProps) => {
	const [editing, setEditing] = useState(false);

	return (
		<>
			<TD>
				<span>{formatDate(tx.date)}</span>
			</TD>
			<TD>
				<span>{tx.description}</span>
			</TD>
			<TD>
				<span>
					{projects?.find((project) => project.id === tx.projectId)?.name}
				</span>
			</TD>
			<TD>
				<span>${tx.amount.toFixed(2)}</span>
			</TD>
			<TD>
				{path.length > 0 ? (
					<FileStatusCell
						path={path}
						txId={tx.id}
						onReplaceFile={onReplaceFile}
					/>
				) : (
					<NoFileCell txId={tx.id} onReplaceFile={onReplaceFile} />
				)}
			</TD>
			<TD className={styles.buttonsCell}>
				<Button
					variant="ghost"
					type="button"
					size="icon"
					onClick={() => setEditing(true)}
					aria-label="Edit Transaction"
				>
					<Edit />
				</Button>
				<Button
					onClick={async () => {
						const confirmed = window.confirm(
							"Are you sure you want to delete this transaction?",
						);
						if (!confirmed) return;

						await onDelete(tx.id);
					}}
					variant="ghost"
					size="icon"
					type="submit"
					aria-label="Delete Transaction"
				>
					<TrashIcon />
				</Button>
			</TD>
			<TransactionDialog
				isOpen={editing}
				tx={tx}
				projects={projects}
				onSave={async (fd) => {
					await onSave(fd);
					setEditing(false);
				}}
				onClose={() => setEditing(false)}
			/>
		</>
	);
};
