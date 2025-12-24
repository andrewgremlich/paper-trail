import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { deleteTimesheet, getTimesheetById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import {
	generateInvoice,
	getInvoice,
	markInvoiceAsPaid,
	voidInvoice,
} from "../lib/stripeApi";
import { Button } from "./Button";
import { Card, CardContent, CardFooter, CardHeader } from "./Card";
import { CreateTimesheetRecord } from "./CreateTimesheetRecord";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { H1, P } from "./HtmlElements";
import { Input } from "./Input";
import { TimesheetTable } from "./TimesheetTable";

export const TimesheetModal = () => {
	const queryClient = useQueryClient();
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
	const { data: invoiceData } = useQuery({
		queryKey: ["invoice", timesheet?.invoiceId],
		queryFn: async () => {
			if (!timesheet?.invoiceId) {
				return null;
			}
			const invoiceData = await getInvoice(timesheet.invoiceId);

			return invoiceData;
		},
		// TODO: re-enable when needed
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
	const { mutate: voidInv } = useMutation({
		mutationFn: async (invoiceId: string | undefined) => {
			if (invoiceId) {
				await voidInvoice(invoiceId);
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
					<Flex justify="between">
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
							<Input type="hidden" name="id" defaultValue={timesheet?.id} />
							<Button
								variant="ghost"
								size="icon"
								className="ml-2"
								type="submit"
								aria-label="Delete timesheet"
							>
								<TrashIcon className="w-6 h-6 hover:text-blue-500" />
							</Button>
						</form>
					</Flex>
					<Flex justify="between">
						<div>
							{timesheet?.description ? (
								<P>Description: {timesheet?.description}</P>
							) : null}
							{timesheet?.projectRate && (
								<P>Project Rate: ${timesheet.projectRate}/hour</P>
							)}
							<P>
								{timesheet?.customerId &&
									`Customer ID: ${timesheet.customerId}`}
							</P>
						</div>
						<div>
							{timesheet?.invoiceId && <P>Invoice ID: {timesheet?.invoiceId}</P>}
							{invoiceData?.status === "paid" && (
								<P>Invoice has been marked as paid.</P>
							)}
							{invoiceData?.pdf && (
								<P>
									Invoice PDF is available.{" "}
									<a
										className="text-blue-500 underline underline-offset-4 decoration-dashed"
										href={invoiceData.pdf}
										target="_blank"
										rel="noopener noreferrer"
									>
										Download PDF
									</a>
								</P>
							)}
							{invoiceData?.status === "void" && (
								<P>Invoice has been voided.</P>
							)}
							{timesheet?.invoiceId && (
								<Flex gap="2">
									<Button
										onClick={async () => {
											if (timesheet?.invoiceId)
												await markAsPaid(timesheet?.invoiceId);
										}}
										disabled={invoiceData?.disabled ?? false}
									>
										{invoiceData?.status === "paid"
											? "Already Paid"
											: invoiceData?.disabled
												? "Disabled"
												: "Mark as Paid"}
									</Button>
									<Button
										onClick={async () => {
											if (timesheet?.invoiceId)
												await voidInv(timesheet?.invoiceId);
										}}
										disabled={invoiceData?.disabled ?? false}
									>
										{invoiceData?.status === "void"
											? "AlreadyVoided"
											: invoiceData?.disabled
												? "Void Disabled"
												: "Void Invoice"}
									</Button>
								</Flex>
							)}
						</div>
					</Flex>
				</CardHeader>
				<CardContent>
					{timesheet && (
						<>
							<CreateTimesheetRecord
								closed={timesheet.closed}
								timesheetId={timesheet.id}
								projectRate={timesheet.projectRate ?? 25}
							/>
							<TimesheetTable
								entries={timesheet.entries || []}
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
						<Input
							type="hidden"
							name="timesheetId"
							defaultValue={timesheet?.id}
						/>
						{timesheet?.customerId && (
							<Input
								type="hidden"
								name="customerId"
								defaultValue={timesheet?.customerId}
							/>
						)}
						<Button
							type="submit"
							variant="default"
							disabled={timesheet?.closed || timesheet?.entries.length === 0}
						>
							{isPending
								? "Generating..."
								: !timesheet?.closed
									? "Generate Invoice"
									: "Invoice Generated"}
						</Button>
					</form>
				</CardFooter>
			</Card>
		</Dialog>
	);
};
