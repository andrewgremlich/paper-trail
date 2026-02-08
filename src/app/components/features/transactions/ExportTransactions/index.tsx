import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Transaction } from "@/lib/db/types";
import {
	exportTransactionsAsCsv,
	exportTransactionsAsJson,
} from "@/lib/files/exportTransactions";
import styles from "./styles.module.css";

type ExportTransactionsProps = {
	transactions: Transaction[];
	projectName: string;
};

export const ExportTransactions = ({
	transactions,
	projectName,
}: ExportTransactionsProps) => {
	const [showMenu, setShowMenu] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const handleExport = async (format: "csv" | "json") => {
		setShowMenu(false);
		setIsExporting(true);
		try {
			const result =
				format === "csv"
					? await exportTransactionsAsCsv(transactions, projectName)
					: await exportTransactionsAsJson(transactions, projectName);
			window.alert(`Exported to ${result.filePath}`);
		} catch (err) {
			console.error("Export failed:", err);
		} finally {
			setIsExporting(false);
		}
	};

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setShowMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<div ref={menuRef} className={styles.wrapper}>
			<Button
				type="button"
				variant="ghost"
				isLoading={isExporting}
				onClick={() => setShowMenu((prev) => !prev)}
				leftIcon={<Upload size={16} />}
				disabled={!transactions.length}
			>
				Export Transactions
			</Button>
			{showMenu && (
				<div className={styles.menu}>
					<button
						type="button"
						className={styles.menuItem}
						onClick={() => handleExport("csv")}
					>
						CSV
					</button>
					<button
						type="button"
						className={styles.menuItem}
						onClick={() => handleExport("json")}
					>
						JSON
					</button>
				</div>
			)}
		</div>
	);
};
