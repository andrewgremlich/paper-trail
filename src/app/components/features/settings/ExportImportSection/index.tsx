import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Lock, Unlock, Upload } from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { handleExportData, handleImportData } from "@/lib/files/exportImport";
import styles from "./styles.module.css";

export const ExportImportSection = () => {
	const queryClient = useQueryClient();
	const [encrypted, setEncrypted] = useState(false);

	const exportMutation = useMutation({
		mutationFn: (encryptBackup: boolean) => handleExportData(encryptBackup),
	});
	const importMutation = useMutation({
		mutationFn: handleImportData,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
		},
	});

	const isLoading = exportMutation.isPending || importMutation.isPending;

	return (
		<div className={styles.container}>
			<H3>Backup & Restore</H3>
			<P>
				Export all your data for backup, or import a previously exported backup
				file.
			</P>

			<Flex gap="1rem" className={styles.encryptToggle}>
				<label className={styles.checkboxLabel}>
					<input
						type="checkbox"
						checked={encrypted}
						onChange={(e) => setEncrypted(e.target.checked)}
						disabled={isLoading}
					/>
					<span className={styles.checkboxText}>
						{encrypted ? (
							<>
								<Lock size={14} aria-hidden="true" /> Encrypted backup
							</>
						) : (
							<>
								<Unlock size={14} aria-hidden="true" /> Readable backup
							</>
						)}
					</span>
				</label>
			</Flex>

			<P className={styles.encryptHint}>
				{encrypted
					? "Sensitive fields will remain encrypted. Can only be restored with the same encryption key. Exported as JSON."
					: "All data exported in plaintext as a ZIP archive, including uploaded files."}
			</P>

			<Flex gap="1rem" className={styles.buttonGroup}>
				<Button
					onClick={() => {
						exportMutation.reset();
						exportMutation.mutate(encrypted);
					}}
					disabled={isLoading}
					isLoading={exportMutation.isPending}
					leftIcon={<Upload size={16} />}
					variant="default"
				>
					Export Data
				</Button>

				<Button
					onClick={() => {
						importMutation.reset();
						importMutation.mutate();
					}}
					disabled={isLoading}
					isLoading={importMutation.isPending}
					leftIcon={<Download size={16} />}
					variant="secondary"
				>
					Import Data
				</Button>

				<Button
					onClick={() => {
						const link = document.createElement("a");
						link.href = "/api/v1/transactions/xlsx";
						link.download = "transactions.xlsx";
						link.click();
					}}
					disabled={isLoading}
					leftIcon={<FileSpreadsheet size={16} />}
					variant="secondary"
				>
					Download Transactions XLSX
				</Button>
			</Flex>

			{exportMutation.isSuccess && exportMutation.data && (
				<div className={styles.successMessage}>
					Data exported successfully to {exportMutation.data.fileName}
				</div>
			)}

			{exportMutation.isError && exportMutation.error && (
				<div className={styles.errorMessage}>
					Export failed:{" "}
					{exportMutation.error instanceof Error
						? exportMutation.error.message
						: "Unknown error"}
				</div>
			)}

			{importMutation.isSuccess && importMutation.data && (
				<div className={styles.successMessage}>
					Data imported successfully! {importMutation.data.projectsCount}{" "}
					projects, {importMutation.data.timesheetsCount} timesheets,{" "}
					{importMutation.data.entriesCount} entries,{" "}
					{importMutation.data.transactionsCount} transactions restored.
				</div>
			)}

			{importMutation.isError && importMutation.error && (
				<div className={styles.errorMessage}>
					Import failed:{" "}
					{importMutation.error instanceof Error
						? importMutation.error.message
						: "Unknown error"}
				</div>
			)}
		</div>
	);
};
