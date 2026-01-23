import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GenerateInvoice } from "@/components/features/invoices/GenerateInvoice";
import { PayVoidButtons } from "@/components/features/invoices/PayVoidButtons";
import { Flex } from "@/components/layout/Flex";
import { H2, P } from "@/components/layout/HtmlElements";
import { DeleteItem } from "@/components/shared/DeleteItem";
import { EditToggleButton } from "@/components/shared/EditToggleButton";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { deleteTimesheet, getTimesheetById } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { CreateTimesheetRecord } from "../CreateTimesheetRecord";
import { TimesheetEditForm } from "../TimesheetEditForm";
import { TimesheetTable } from "../TimesheetTable";
import styles from "./styles.module.css";

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
			className={styles.dialog}
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
							actionFn={async (formData: FormData) => {
								const id = Number(formData.get("id") || 0);
								await deleteTimesheet(id);
							}}
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
				<Grid
					rows={timesheet?.invoiceId ? 4 : 3}
					flow="col"
					columnGap={24}
					className={styles.infoGrid}
				>
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
					{timesheet?.invoiceId && <P>Invoice ID: {timesheet?.invoiceId}</P>}
					{timesheet?.invoiceId && <PayVoidButtons timesheet={timesheet} />}
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
						projectRate={timesheet.projectRate ?? 25}
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
