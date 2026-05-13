import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import classnames from "classnames";

import { GenerateInvoice } from "@/components/features/invoices/GenerateInvoice";
import { PayVoidButtons } from "@/components/features/invoices/PayVoidButtons";
import { Flex } from "@/components/layout/Flex";
import { H2, Span } from "@/components/layout/HtmlElements";
import { DeleteItem } from "@/components/shared/DeleteItem";
import { EditToggleButton } from "@/components/shared/EditToggleButton";
import { Dialog } from "@/components/ui/Dialog";
import { Grid } from "@/components/ui/Grid";
import { deleteTimesheet, getTimesheetById } from "@/lib/db";
import { getCustomer } from "@/lib/db/customers";
import { getInvoices } from "@/lib/db/invoices";
import { usePaperTrailStore } from "@/lib/store";

import { CreateTimesheetRecord } from "../CreateTimesheetRecord";
import { TimesheetEditForm } from "../TimesheetEditForm";
import { TimesheetTable } from "../TimesheetTable";
import styles from "./styles.module.css";

export const TimesheetModal = () => {
	const [isEditing, setIsEditing] = useState(false);
	const headingId = useId();
	const { activeModal, closeModal: closeTimesheetModal } = usePaperTrailStore();
	const activeTimesheetId =
		activeModal?.type === "timesheet" ? activeModal.timesheetId : undefined;
	const { data: timesheet } = useQuery({
		queryKey: ["timesheet", activeTimesheetId],
		queryFn: async () => {
			if (activeTimesheetId) {
				return await getTimesheetById(activeTimesheetId);
			}
		},
		enabled: !!activeTimesheetId,
	});

	// Find an invoice already linked to this timesheet, if any. The relationship
	// is invoice → timesheet now, so we filter the user's invoice list.
	const { data: timesheetInvoice } = useQuery({
		queryKey: ["invoice-by-timesheet", activeTimesheetId],
		queryFn: async () => {
			const all = await getInvoices();
			return all.find((i) => i.timesheetId === activeTimesheetId) ?? null;
		},
		enabled: !!activeTimesheetId,
	});

	// Customer linked through the timesheet's project. The /timesheets/:id
	// response carries the FK; resolve it to a name for display.
	const { data: customer } = useQuery({
		queryKey: ["customer", timesheet?.customerId],
		queryFn: () => {
			if (!timesheet?.customerId) return null;
			return getCustomer(timesheet.customerId);
		},
		enabled: !!timesheet?.customerId,
	});

	return (
		<Dialog
			isOpen={activeModal?.type === "timesheet"}
			onClose={closeTimesheetModal}
			titleId={headingId}
		>
			<Flex justify="between" className={styles.header}>
				<H2 id={headingId} style={{ marginBottom: 0 }}>
					{timesheet?.name}
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
								const id = String(formData.get("id") ?? "");
								await deleteTimesheet(id);
							}}
							successFn={closeTimesheetModal}
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
					gap={4}
					className={classnames(styles.infoGrid, styles.timesheetInfoSpan)}
					cols={2}
				>
					{timesheet?.id && <Span>ID: {timesheet.id}</Span>}
					{timesheet?.description && (
						<Span>Description: {timesheet?.description}</Span>
					)}
					{timesheet?.projectRate && (
						<Span>
							Project Rate: ${(timesheet.projectRate / 100).toFixed(2)}/hour
						</Span>
					)}
					{timesheet?.customerId && (
						<Span>
							Customer:{" "}
							{customer ? `${customer.name} (${customer.email})` : "…"}
						</Span>
					)}
					{timesheetInvoice && <span>Invoice: {timesheetInvoice.number}</span>}
				</Grid>
			)}
			{timesheetInvoice && <PayVoidButtons invoice={timesheetInvoice} />}
			{timesheet && (
				<>
					<CreateTimesheetRecord
						active={timesheet.active}
						timesheetId={timesheet.id}
						projectRate={timesheet.projectRate ?? 25}
						hasActiveInvoice={!!timesheetInvoice && timesheetInvoice.status !== "void"}
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
