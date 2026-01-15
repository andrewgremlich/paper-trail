import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Edit, Save, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Flex } from "@/components/layout/Flex";
import { H2, Label, P } from "@/components/layout/HtmlElements";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import {
	deleteTimesheetEntry,
	type TimesheetEntry,
	updateTimesheetEntry,
} from "@/lib/db";
import { normalizeDateInput } from "@/lib/db/utils";
import { usePaperTrailStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";

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
							<TH className="text-nowrap">Amount ($)</TH>
							<TH></TH>
							<TH></TH>
						</TR>
					</THead>
					<TBody>
						{entries.map((entry) => (
							<TR key={entry.id}>
								{editingId === entry.id ? (
									<>
										<TD>
											<Input
												name="date"
												type="date"
												defaultValue={entry.date}
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>
											<Input
												name="hours"
												type="number"
												step="0.25"
												defaultValue={entry.minutes / 60}
												className="w-24"
												min={0}
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>
											<Input
												name="description"
												type="text"
												defaultValue={entry.description}
												className="w-full"
												form={`edit-form-${entry.id}`}
												required
											/>
										</TD>
										<TD>${(entry.amount / 100).toFixed(2)}</TD>
										<TD>
											<form
												id={`edit-form-${entry.id}`}
												onSubmit={async (evt) => {
													evt.preventDefault();
													const formData = new FormData(evt.currentTarget);
													await saveEdit(formData);
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
													variant="ghost"
													disabled={!active}
												>
													<Save color="black" />
												</Button>
											</form>
										</TD>
										<TD>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												onClick={() => setEditingId(null)}
											>
												<Ban color="black" />
											</Button>
										</TD>
									</>
								) : (
									<>
										<TD className="text-nowrap">{formatDate(entry.date)}</TD>
										<TD>{entry.minutes / 60}</TD>
										<TD>{entry.description}</TD>
										<TD>${(entry.amount / 100).toFixed(2)}</TD>
										<TD>
											<Button
												type="button"
												disabled={!active}
												variant="ghost"
												size="sm"
												onClick={() => setEditingId(entry.id)}
											>
												<Edit color="black" />
											</Button>
											<form
												onSubmit={(evt) => {
													evt.preventDefault();
													const formData = new FormData(evt.currentTarget);
													deleteEntry(formData);
												}}
											>
												<input type="hidden" name="id" value={entry.id} />
											</form>
										</TD>
										<TD>
											<Button
												disabled={!active}
												variant="ghost"
												size="sm"
												type="submit"
											>
												<TrashIcon color="black" />
											</Button>
										</TD>
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
