import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";
import { createTimesheetEntry } from "../lib/db";
import { Button } from "./Button";
import { Flex } from "./Flex";
import { Input } from "./Input";

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
	const { mutate } = useMutation({
		mutationFn: async (formData: FormData) => {
			await createTimesheetEntry(formData);
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", timesheetId],
			});
		},
	});

	return (
		<form
			onSubmit={(evt) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget);
				mutate(formData);
				evt.currentTarget.reset();
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
					variant="ghost"
					size="icon"
					disabled={!active}
					className="disabled:bg-gray-300 disabled:cursor-not-allowed shrink-0 px-3 h-10 bg-blue-600 hover:bg-blue-700 text-primary-foreground rounded-md"
				>
					<PlusIcon className="h-4 w-4" />
				</Button>
			</Flex>
		</form>
	);
};
