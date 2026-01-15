import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";
import { Flex } from "@/components/layout/Flex";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTimesheetEntry } from "@/lib/db";
import { normalizeDateInput } from "@/lib/db/utils";

export const CreateTimesheetRecord = ({
	timesheetId,
	projectRate,
	active,
}: {
	timesheetId: number;
	projectRate: number;
	active: boolean;
}) => {
	const queryClient = useQueryClient();
	const { mutateAsync } = useMutation({
		mutationFn: async (formData: FormData) => {
			const timesheetId = Number(formData.get("timesheetId") || 0);
			const projectRate = Number(formData.get("projectRate") || 0);
			const dateRaw = String(formData.get("date") || "");
			const date = normalizeDateInput(dateRaw);
			const hours = Number(formData.get("hours") || 0);
			const minutes = Math.max(0, hours) * 60;
			const description = String(formData.get("description") || "").trim();
			const amountDollars =
				(Math.max(0, projectRate) * Math.max(0, minutes)) / 60;
			const amountInCents = Math.round(amountDollars * 100);

			await createTimesheetEntry({
				date,
				minutes,
				description,
				timesheetId,
				amount: amountInCents,
			});
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", timesheetId],
			});
		},
	});

	return (
		<form
			onSubmit={async (evt) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget);
				try {
					await mutateAsync(formData);
					evt.currentTarget.reset();
				} catch (e) {
					console.error(e);
				}
			}}
		>
			<input type="hidden" name="timesheetId" value={timesheetId} />
			<input type="hidden" name="projectRate" value={projectRate} />
			<Flex justify="between" items="end">
				<Flex gap={20}>
					<Input
						name="date"
						label="Date"
						type="date"
						defaultValue={format(new Date(), "yyyy-MM-dd")}
						required
					/>
					<Input
						name="hours"
						type="number"
						step="0.25"
						label="Hours"
						min="0.25"
						placeholder="Hours worked"
						required
					/>
					<Input
						name="description"
						label="Description"
						placeholder="Work description"
						required
					/>
				</Flex>
				<Button
					type="submit"
					variant="secondary"
					size="icon"
					disabled={!active}
				>
					<PlusIcon className="h-4 w-4" />
				</Button>
			</Flex>
		</form>
	);
};
