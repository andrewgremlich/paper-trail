import { Table, TBody, TH, THead, TR } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import { TransactionTotalRow } from "../TransactionTotalRow";
import { TransactionViewRow } from "../TransactionViewRow";
import styles from "./styles.module.css";

interface TransactionListProps {
	transactions: Transaction[];
	projects: Project[] | undefined;
	onSave: (formData: FormData) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onReplaceFile: (id: string, newPath: string) => Promise<void>;
}

export const TransactionList = ({
	transactions,
	projects,
	onSave,
	onDelete,
	onReplaceFile,
}: TransactionListProps) => {
	if (!transactions || transactions.length === 0) {
		return <p>No transactions found.</p>;
	}

	return (
		<Table wrapperClassName={styles.tableWrapper}>
			<THead>
				<TR>
					<TH>Date</TH>
					<TH>Description</TH>
					<TH>Project</TH>
					<TH>Amount</TH>
					<TH>File</TH>
					<TH>Actions</TH>
				</TR>
			</THead>
			<TBody>
				{transactions.map((tx) => (
					<TR key={tx.id}>
						<TransactionViewRow
							tx={tx}
							projects={projects}
							path={tx.filePath ?? ""}
							onSave={onSave}
							onDelete={onDelete}
							onReplaceFile={onReplaceFile}
						/>
					</TR>
				))}
				<TransactionTotalRow transactions={transactions} />
			</TBody>
		</Table>
	);
};
