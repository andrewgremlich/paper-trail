import { Table, TBody, TH, THead, TR } from "@/components/ui/Table";
import type { Project, Transaction } from "@/lib/db";
import { TransactionEditRow } from "../TransactionEditRow";
import { TransactionTotalRow } from "../TransactionTotalRow";
import { TransactionViewRow } from "../TransactionViewRow";

interface TransactionListProps {
	transactions: Transaction[];
	projects: Project[] | undefined;
	editingId: number | null;
	onEdit: (id: number) => void;
	onCancelEdit: () => void;
	onSave: (formData: FormData) => Promise<void>;
	onDelete: (formData: FormData) => Promise<void>;
}

export const TransactionList = ({
	transactions,
	projects,
	editingId,
	onEdit,
	onCancelEdit,
	onSave,
	onDelete,
}: TransactionListProps) => {
	if (!transactions || transactions.length === 0) {
		return <p>No transactions found.</p>;
	}

	return (
		<Table>
			<THead>
				<TR>
					<TH>Date</TH>
					<TH>Description</TH>
					<TH>Project</TH>
					<TH>Amount</TH>
					<TH>File</TH>
					<TH>Edit</TH>
					<TH>Delete</TH>
				</TR>
			</THead>
			<TBody>
				{transactions.map((tx) => {
					const path = tx.filePath ?? "";
					return (
						<TR key={tx.id}>
							{editingId === tx.id ? (
								<TransactionEditRow
									tx={tx}
									projects={projects}
									path={path}
									onSave={onSave}
									onCancel={onCancelEdit}
								/>
							) : (
								<TransactionViewRow
									tx={tx}
									projects={projects}
									path={path}
									onEdit={() => onEdit(tx.id)}
									onDelete={onDelete}
								/>
							)}
						</TR>
					);
				})}
				<TransactionTotalRow transactions={transactions} />
			</TBody>
		</Table>
	);
};
