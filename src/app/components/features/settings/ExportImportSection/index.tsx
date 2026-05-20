import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Flex } from "@/components/layout/Flex";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { handleExportData, handleImportData } from "@/lib/files/exportImport";
import styles from "./styles.module.css";

export const ExportImportSection = () => {
	const queryClient = useQueryClient();

	const exportMutation = useMutation({
		mutationFn: handleExportData,
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

			<P className={styles.encryptHint}>
				All data exported in plaintext as a ZIP archive, including uploaded
				files. Use your own tooling if you want the export encrypted at rest.
			</P>

			<Flex gap="1rem" className={styles.buttonGroup}>
				<Button
					onClick={() => {
						exportMutation.reset();
						exportMutation.mutate();
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
