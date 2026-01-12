import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { handleExportData, handleImportData } from "@/lib/exportImport";
import { Button } from "./Button";
import { H3, P } from "./HtmlElements";

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
		<div className="space-y-4 border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
			<div>
				<H3>Backup & Restore</H3>
				<P className="text-sm text-neutral-600 dark:text-neutral-400">
					Export all your data to a JSON file for backup, or import a previously
					exported backup file.
				</P>
			</div>

			<div className="flex gap-3">
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
				<div className="p-3 rounded text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
					Data exported successfully to {exportMutation.data.fileName}
				</div>
			)}

			{exportMutation.isError && exportMutation.error && (
				<div className="p-3 rounded text-sm bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
					Export failed:{" "}
					{exportMutation.error instanceof Error
						? exportMutation.error.message
						: "Unknown error"}
				</div>
			)}

			{importMutation.isSuccess && importMutation.data && (
				<div className="p-3 rounded text-sm bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
					Data imported successfully! {importMutation.data.projectsCount}{" "}
					projects, {importMutation.data.timesheetsCount} timesheets,{" "}
					{importMutation.data.entriesCount} entries,{" "}
					{importMutation.data.transactionsCount} transactions restored.
				</div>
			)}

			{importMutation.isError && importMutation.error && (
				<div className="p-3 rounded text-sm bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
					Import failed:{" "}
					{importMutation.error instanceof Error
						? importMutation.error.message
						: "Unknown error"}
				</div>
			)}
		</div>
	);
};
