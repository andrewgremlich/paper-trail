import { TD, TR } from "@/components/ui/Table";
import type { Transaction } from "@/lib/db";
import styles from "./styles.module.css";

interface TransactionTotalRowProps {
	transactions: Transaction[];
}

export const TransactionTotalRow = ({
	transactions,
}: TransactionTotalRowProps) => {
	const total = transactions.reduce((acc, tx) => acc + tx.amount, 0);

	return (
		<TR>
			<TD colSpan={3} />
			<TD className={styles.totalCell}>Total: ${total.toFixed(2)}</TD>
			<TD colSpan={3} />
		</TR>
	);
};
