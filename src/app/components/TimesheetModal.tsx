import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";

import {
	deleteTimesheet,
	generateInvoice,
	getTimesheetById,
} from "../lib/dbClient";
import { useSimpletimesheetStore } from "../lib/store";
import { getInvoice, markInvoiceAsPaid } from "../lib/stripeHttpClient";
import { Card, CardContent, CardFooter, CardHeader } from "./Card";
import { CreateTimesheetRecord } from "./CreateTimesheetRecord";
import { Dialog } from "./Dialog";
import { H1, P } from "./HtmlElements";
import { TimesheetTable } from "./TimesheetTable";

export const TimesheetModal = () => {
	const queryClient = useQueryClient();
	const { timesheetModalActive, toggleTimesheetModal, activeTimesheetId } =
		useSimpletimesheetStore();
	const { data: timesheet } = useQuery({
		queryKey: ["timesheet", activeTimesheetId],
		queryFn: () =>
			activeTimesheetId ? getTimesheetById(activeTimesheetId) : null,
		enabled: !!activeTimesheetId,
	});
	const { data: invoiceData } = useQuery({
		queryKey: ["invoice", timesheet?.invoiceId],
		queryFn: async () => {
			if (!timesheet?.invoiceId) {
				return null;
			}

			const invoiceData = await getInvoice(timesheet.invoiceId);
			return invoiceData.invoice;
		},
		// enabled: !!timesheet?.invoiceId,
	});
	const {
		mutate: mutateInvoice,
		isPending,
		isSuccess,
		isError,
	} = useMutation({
		mutationFn: async (formData: FormData) => {
			await generateInvoice(formData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["timesheet", activeTimesheetId],
			});
		},
	});
	const { mutate: mutateDeleteTimesheet } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteTimesheet(formData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
			toggleTimesheetModal({ timesheetId: undefined });
		},
	});
	const { mutate: markAsPaid } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await markInvoiceAsPaid(invoiceId);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["invoice", timesheet?.invoiceId],
			});
		},
	});

	return (
		<Dialog
			isOpen={timesheetModalActive}
			onClose={() => toggleTimesheetModal({ timesheetId: undefined })}
		>
			{isSuccess && (
				<div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
					{timesheet?.invoiceId
						? `Invoice ${timesheet.invoiceId} generated successfully!`
						: "Action completed successfully!"}
				</div>
			)}
			{isError && (
				<div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
					Error: {isError}
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="w-full flex justify-between">
						<H1>
							{timesheet?.name ?? "Timesheet Invoice Generator"}
							{timesheet?.closed && " (Closed)"}
						</H1>
						<form
							onSubmit={async (evt) => {
								evt.preventDefault();
								const formData = new FormData(evt.currentTarget);
								await mutateDeleteTimesheet(formData);
							}}
						>
							<input type="hidden" name="id" value={timesheet?.id} />
							<button
								className="hover:cursor-pointer p-2 rounded"
								type="submit"
								aria-label="Delete timesheet"
							>
								<TrashIcon className="w-6 h-6 hover:text-blue-500" />
							</button>
						</form>
					</div>
					{timesheet?.description ? <P>{timesheet?.description}</P> : null}
					<P>
						{timesheet?.customerId && `Customer ID: ${timesheet.customerId}`}
					</P>
					{timesheet?.invoiceId && (
						<form
							onSubmit={async (evt) => {
								evt.preventDefault();
								const formData = new FormData(evt.currentTarget);
								const invoiceId = formData.get("invoiceId");
								await markAsPaid(invoiceId?.toString());
							}}
						>
							<P>Invoice ID: {timesheet?.invoiceId}</P>
							{invoiceData?.status === "paid" && (
								<P>Invoice has been marked as paid.</P>
							)}
							<input
								type="hidden"
								name="invoiceId"
								value={timesheet?.invoiceId}
							/>
							<button
								disabled={invoiceData?.status === "paid"}
								type="submit"
								className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md  ${
									invoiceData?.status === "paid"
										? "bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300"
										: "cursor-pointer"
								}`}
							>
								{invoiceData?.status === "paid"
									? "Has been paid"
									: "Mark as Paid"}
							</button>
						</form>
					)}
				</CardHeader>
				<CardContent>
					{timesheet && (
						<>
							<CreateTimesheetRecord
								closed={timesheet.closed}
								timesheetId={timesheet.id}
								rate={timesheet.projectRate ?? 25}
							/>
							<TimesheetTable
								entries={timesheet.records || []}
								closed={timesheet.closed}
							/>
						</>
					)}
				</CardContent>
				<CardFooter>
					<form
						onSubmit={async (e) => {
							e.preventDefault();
							const formData = new FormData(e.currentTarget);
							await mutateInvoice(formData);
						}}
						className="flex gap-2"
					>
						<input
							type="hidden"
							name="timesheetId"
							defaultValue={timesheet?.id}
						/>
						{timesheet?.customerId && (
							<input
								type="hidden"
								name="customerId"
								defaultValue={timesheet?.customerId}
							/>
						)}
						<button
							type="submit"
							disabled={timesheet?.closed}
							className={`shrink-0 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md cursor-pointer`}
						>
							{isPending
								? "Generating..."
								: !timesheet?.closed
									? "Generate Invoice"
									: "Invoice Closed"}
						</button>
					</form>
				</CardFooter>
			</Card>
		</Dialog>
	);
};
