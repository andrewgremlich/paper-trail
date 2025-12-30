import { useQuery } from "@tanstack/react-query";
import { getTimesheetById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { CreateTimesheetRecord } from "./CreateTimesheetRecord";
import { DeleteTimesheetIcon } from "./DeleteTimesheet";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { GenerateInvoice } from "./GenerateInvoice";
import { H2, P } from "./HtmlElements";
import { PayVoidButtons } from "./PayVoidButtons";
import { TimesheetTable } from "./TimesheetTable";

export const TimesheetModal = () => {
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
				{timesheet?.id && <DeleteTimesheetIcon timesheetId={timesheet.id} />}
			</Flex>
			<Flex justify="between" className="mb-6">
				<div>
					{timesheet?.description ? (
						<P>Description: {timesheet?.description}</P>
					) : null}
					{timesheet?.projectRate && (
						<P>Project Rate: ${timesheet.projectRate}/hour</P>
					)}
					<P>
						{timesheet?.customerId && `Customer ID: ${timesheet.customerId}`}
					</P>
				</div>
				<div>
					{timesheet?.invoiceId && <P>Invoice ID: {timesheet?.invoiceId}</P>}
					{timesheet?.invoiceId && <PayVoidButtons timesheet={timesheet} />}
				</div>
			</Flex>
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
