import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { deleteTimesheet, getTimesheetById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { CreateTimesheetRecord } from "./CreateTimesheetRecord";
import { DeleteItem } from "./DeleteItem";
import { Dialog } from "./Dialog";
import { EditToggleButton } from "./EditToggleButton";
import { Flex } from "./Flex";
import { GenerateInvoice } from "./GenerateInvoice";
import { Grid } from "./Grid";
import { H2, P } from "./HtmlElements";
import { PayVoidButtons } from "./PayVoidButtons";
import { TimesheetEditForm } from "./TimesheetEditForm";
import { TimesheetTable } from "./TimesheetTable";

export const TimesheetModal = () => {
	const [isEditing, setIsEditing] = useState(false);
	const { timesheetModalActive, toggleTimesheetModal, activeTimesheetId } =
		usePaperTrailStore();
	const { data: timesheet } = useQuery({
		queryKey: ["timesheet", activeTimesheetId],
		queryFn: async () => {
			if (activeTimesheetId) {
				return await getTimesheetById(activeTimesheetId);
			}
		},
		enabled: !!activeTimesheetId,
	});

	return (
		<Dialog
			className="px-10 py-8"
			variant="liquidGlass"
			isOpen={timesheetModalActive}
			onClose={() => toggleTimesheetModal({ timesheetId: undefined })}
		>
			<Flex justify="between">
				<H2>
					{timesheet?.name ?? "Timesheet Invoice Generator"}
					{!timesheet?.active && " (Closed)"}
				</H2>
				<Flex gap={2} items="center">
					<EditToggleButton
						enabled={!!timesheet?.id}
						isEditing={isEditing}
						ariaLabel="Edit timesheet"
						onToggle={async () => {
							setIsEditing((prev) => !prev);
						}}
					/>
					{timesheet?.id && (
						<DeleteItem
							deleteItemId={timesheet.id}
							actionFn={async (formData: FormData) =>
								await deleteTimesheet(formData)
							}
							successFn={() => toggleTimesheetModal({ timesheetId: undefined })}
						/>
					)}
				</Flex>
			</Flex>
			{isEditing && timesheet && (
				<TimesheetEditForm
					timesheet={timesheet}
					onSaved={() => setIsEditing(false)}
				/>
			)}
			{!isEditing && (
				<Grid rows={4} flow="col" gap={6} className="mb-6">
					{timesheet?.invoiceId && <P>Invoice ID: {timesheet?.invoiceId}</P>}
					{timesheet?.invoiceId && <PayVoidButtons timesheet={timesheet} />}
					{timesheet?.description ? (
						<P>Description: {timesheet?.description}</P>
					) : null}
					{timesheet?.projectRate && (
						<P>
							Project Rate: ${(timesheet.projectRate / 100).toFixed(2)}/hour
						</P>
					)}
					<P>
						{timesheet?.customerId && `Customer ID: ${timesheet.customerId}`}
					</P>
				</Grid>
			)}
			{timesheet && (
				<>
					<CreateTimesheetRecord
						active={timesheet.active}
						timesheetId={timesheet.id}
						projectRate={timesheet.projectRate ?? 25}
					/>
					<TimesheetTable
						entries={timesheet.entries || []}
						active={timesheet.active}
					/>
				</>
			)}
			{activeTimesheetId && timesheet && (
				<GenerateInvoice
					timesheet={timesheet}
					activeTimesheetId={activeTimesheetId}
				/>
			)}
		</Dialog>
	);
};
