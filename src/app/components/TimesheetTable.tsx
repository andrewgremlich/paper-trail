import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { usePaperTrailStore } from "@/lib/store";
import { deleteTimesheetEntry, type TimesheetEntry } from "../lib/db";
import { formatDate } from "../lib/utils";
import { Button } from "./Button";
import { Flex } from "./Flex";
import { H2, Label } from "./HtmlElements";
import { Table, TBody, TD, TH, THead, TR } from "./Table";

export const TimesheetTable = ({
	entries,
	active,
}: {
	entries: TimesheetEntry[];
	active: boolean;
}) => {
	const totalAmount = entries.reduce((total, entry) => total + entry.amount, 0);
	const { activeTimesheetId } = usePaperTrailStore();
	const queryClient = useQueryClient();
	const { mutate: deleteEntry } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteTimesheetEntry(formData);
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
	});

	return (
		<div className="my-4">
			{entries.length > 0 ? (
				<Table>
					<THead>
						<TR>
							<TH>Date</TH>
							<TH>Hours</TH>
							<TH>Description</TH>
							<TH>Amount ($)</TH>
							<TH></TH>
						</TR>
					</THead>
					<TBody>
						{entries.map((entry) => (
							<TR key={entry.id}>
								<TD>{formatDate(entry.date)}</TD>
								<TD>{entry.minutes / 60}</TD>
								<TD>{entry.description}</TD>
								<TD>${entry.amount.toFixed(2)}</TD>
								<Flex as="td" justify="end">
									<form
										onSubmit={(evt) => {
											evt.preventDefault();
											const formData = new FormData(evt.currentTarget);
											deleteEntry(formData);
										}}
									>
										<input type="hidden" name="id" value={entry.id} />
										<Button
											disabled={!active}
											variant="ghost"
											size="sm"
											type="submit"
										>
											<TrashIcon color="black" className="h-4 w-4" />
										</Button>
									</form>
									{/* <Button
										disabled={!active}
										variant="ghost"
										size="sm"
										onClick={() => {
											console.log("Edit entry", entry.id);
										}}
									>
										<PencilIcon color="black" className="h-4 w-4" />
									</Button> */}
								</Flex>
							</TR>
						))}
					</TBody>
				</Table>
			) : (
				<div className="text-center py-8 text-gray-500">
					No timesheet entries yet! Add your first entry above.
				</div>
			)}

			{entries.length > 0 && (
				<Flex justify="end">
					<div className="text-right">
						<Label>Total Amount</Label>
						<H2>${totalAmount.toFixed(2)}</H2>
					</div>
				</Flex>
			)}
		</div>
	);
};
