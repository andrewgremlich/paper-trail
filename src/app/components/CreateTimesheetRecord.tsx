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
	const { mutateAsync } = useMutation({
		mutationFn: async (formData: FormData) => {
			await createTimesheetEntry(formData);
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
