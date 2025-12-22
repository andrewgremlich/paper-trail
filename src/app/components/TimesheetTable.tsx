import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { usePaperTrailStore } from "@/lib/store";
import { deleteTimesheetEntry, type TimesheetEntry } from "../lib/db";
import { formatDate } from "../lib/utils";

export const TimesheetTable = ({
	entries,
	closed,
}: {
	entries: TimesheetEntry[];
	closed: boolean;
}) => {
	const totalAmount = entries.reduce((total, entry) => total + entry.amount, 0);
	const { activeTimesheetId } = usePaperTrailStore();
	const queryClient = useQueryClient();
	const { mutate } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteTimesheetEntry(formData);
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
	});

	return (
		<div className="mt-8 space-y-4">
			{entries.length > 0 ? (
				<div className="overflow-hidden border rounded-lg">
					<table className="w-full">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
									Date
								</th>
								<th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
									Hours
								</th>
								<th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
									Description
								</th>
								<th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
									Amount ($)
								</th>
								<th className="px-4 py-3 text-left text-sm font-medium text-gray-900"></th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{entries.map((entry) => (
								<tr key={entry.id}>
									<td className="px-4 py-3 text-sm text-gray-900">
										{formatDate(entry.date)}
									</td>
									<td className="px-4 py-3 text-sm text-gray-900 text-center">
										{entry.hours}
									</td>
									<td className="px-4 py-3 text-sm text-gray-900 max-w-50 truncate">
										{entry.description}
									</td>
									<td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
										${entry.amount.toFixed(2)}
									</td>
									<td className="px-4 py-3 text-sm text-gray-900 text-right">
										<form
											onSubmit={(evt) => {
												evt.preventDefault();
												const formData = new FormData(evt.currentTarget);
												mutate(formData);
											}}
											className="inline"
										>
											<input type="hidden" name="id" value={entry.id} />
											<button
												disabled={closed}
												type="submit"
												className="disabled:opacity-50 disabled:cursor-not-allowed h-8 w-8 p-0 flex items-center justify-center hover:bg-gray-100 rounded "
											>
												<span className="sr-only">Delete entry</span>
												<TrashIcon color="black" className="h-4 w-4" />
											</button>
										</form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="text-center py-8 text-gray-500">
					No timesheet entries yet. Add your first entry above.
				</div>
			)}

			{entries.length > 0 && (
				<div className="flex justify-end">
					<div className="text-right">
						<div className="text-sm text-gray-500">Total Amount</div>
						<div className="text-2xl font-bold dark:text-white text-black">
							${totalAmount.toFixed(2)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
