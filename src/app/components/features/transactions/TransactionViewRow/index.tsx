import { Edit, FolderOpen, Globe, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TD } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import { openAttachment } from "@/lib/fileStorage";
import { formatDate } from "@/lib/utils";
import styles from "./index.module.css";

interface TransactionViewRowProps {
	tx: Transaction;
	projects: Project[] | undefined;
	path: string;
	onEdit: () => void;
	onDelete: (formData: FormData) => Promise<void>;
}

export const TransactionViewRow = ({
	tx,
	projects,
	path,
	onEdit,
	onDelete,
}: TransactionViewRowProps) => (
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
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={async () => {
						await openAttachment(path);
					}}
				>
					{path.startsWith("http://") || path.startsWith("https://") ? (
						<Globe color="black" />
					) : (
						<FolderOpen color="black" />
					)}
				</Button>
			) : (
				<span className={styles.noFile}>No File</span>
			)}
		</TD>
		<TD>
			<Button variant="ghost" type="button" onClick={onEdit}>
				<Edit color="black" />
			</Button>
		</TD>
		<TD>
			<form
				onSubmit={async (evt) => {
					evt.preventDefault();
					const fd = new FormData(evt.currentTarget);
					await onDelete(fd);
				}}
			>
				<input type="hidden" name="id" value={tx.id} />
				<Button
					variant="ghost"
					size="icon"
					type="submit"
					aria-label="Delete Transaction"
				>
					<TrashIcon color="black" />
				</Button>
			</form>
		</TD>
	</>
);
