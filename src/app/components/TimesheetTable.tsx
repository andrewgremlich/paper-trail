import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { usePaperTrailStore } from "@/lib/store";
import {
	deleteTimesheetEntry,
	type TimesheetEntry,
	updateTimesheetEntry,
} from "../lib/db";
import { formatDate } from "../lib/utils";
import { Button } from "./Button";
import { Flex } from "./Flex";
import { H2, Label, P } from "./HtmlElements";
import { Table, TBody, TD, TH, THead, TR } from "./Table";
import { normalizeDateInput } from "@/lib/db/utils";

export const TimesheetTable = ({
	entries,
	active,
	projectRate,
}: {
	entries: TimesheetEntry[];
	active: boolean;
	projectRate: number;
}) => {
	const [editingId, setEditingId] = useState<number | null>(null);
	const totalAmount = entries.reduce((total, entry) => total + entry.amount, 0);
	const { activeTimesheetId } = usePaperTrailStore();
	const queryClient = useQueryClient();
	const { mutate: deleteEntry } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") || 0);
			await deleteTimesheetEntry(id);
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
	});
	const { mutateAsync: saveEdit } = useMutation({
		mutationFn: async (formData: FormData) => {
			const id = Number(formData.get("id") || 0);
			const projectRate = Number(formData.get("projectRate") || 0);
			const dateRaw = String(formData.get("date") || "");
			const date = normalizeDateInput(dateRaw);
			const hours = Number(formData.get("hours") || 0);
			const minutes = Math.max(0, hours) * 60;
			const description = String(formData.get("description") || "").trim();
			const amountDollars =
				(Math.max(0, projectRate) * Math.max(0, minutes)) / 60;
			const amountInCents = Math.round(amountDollars * 100);
			await updateTimesheetEntry({
				id,
				date,
				minutes,
				description,
				amount: amountInCents,
			});
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
		onSuccess: async () => {
			setEditingId(null);
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
								{editingId === entry.id ? (
									<>
										<TD>
											<input
												name="date"
												type="date"
												defaultValue={entry.date}
												className="border px-2 py-1 rounded-md"
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>
											<input
												name="hours"
												type="number"
												step="0.25"
												defaultValue={entry.minutes / 60}
												className="border px-2 py-1 rounded-md w-24"
												min={0}
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>
											<input
												name="description"
												type="text"
												defaultValue={entry.description}
												className="border px-2 py-1 rounded-md w-full"
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>${(entry.amount / 100).toFixed(2)}</TD>
										<Flex as="td" justify="end" gap={8}>
											<form
												id={`edit-form-${entry.id}`}
												onSubmit={async (evt) => {
													evt.preventDefault();
													const formData = new FormData(evt.currentTarget);
													try {
														await saveEdit(formData);
													} catch (e) {
														console.error(e);
													}
												}}
											>
												<input type="hidden" name="id" value={entry.id} />
												<input
													type="hidden"
													name="projectRate"
													value={projectRate}
												/>
												<Button
													type="submit"
													size="sm"
													variant="secondary"
													disabled={!active}
												>
													Save
												</Button>
											</form>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => setEditingId(null)}
											>
												Cancel
											</Button>
										</Flex>
									</>
								) : (
									<>
										<TD>{formatDate(entry.date)}</TD>
										<TD>{entry.minutes / 60}</TD>
										<TD>{entry.description}</TD>
										<TD>${(entry.amount / 100).toFixed(2)}</TD>
										<Flex as="td" justify="end" gap={8}>
											<Button
												type="button"
												disabled={!active}
												variant="ghost"
												size="sm"
												onClick={() => setEditingId(entry.id)}
											>
												<PencilIcon color="black" className="h-4 w-4" />
											</Button>
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
										</Flex>
									</>
								)}
							</TR>
						))}
					</TBody>
				</Table>
			) : (
				<Flex justify="center" className="py-8">
					<P>No timesheet entries yet! Add your first entry above.</P>
				</Flex>
			)}

			{entries.length > 0 && (
				<Flex justify="end">
					<div className="text-right">
						<Label>Total Amount</Label>
						<H2>${(totalAmount / 100).toFixed(2)}</H2>
					</div>
				</Flex>
			)}
		</div>
	);
};
