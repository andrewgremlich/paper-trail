import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { H3, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { handleExportData, handleImportData } from "@/lib/exportImport";
import styles from "./index.module.css";

export const ExportImportSection = () => {
	const queryClient = useQueryClient();
	const exportMutation = useMutation({
		mutationFn: handleExportData,
	});
	const importMutation = useMutation({
		mutationFn: handleImportData,
		onSuccess: async () => {
			// Invalidate all queries to refresh the UI
			await queryClient.invalidateQueries();
		},
	});

	const isLoading = exportMutation.isPending || importMutation.isPending;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<H3>Backup & Restore</H3>
				<P className={styles.description}>
					Export all your data to a JSON file for backup, or import a previously
					exported backup file.
				</P>
			</div>

			<div className={styles.buttonGroup}>
				<Button
					onClick={() => {
						exportMutation.reset();
						exportMutation.mutate();
					}}
					disabled={isLoading}
					isLoading={exportMutation.isPending}
					leftIcon={<Download size={16} />}
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
					leftIcon={<Upload size={16} />}
					variant="secondary"
				>
					Import Data
				</Button>
			</div>

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
