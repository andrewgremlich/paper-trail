import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { PlusIcon } from "lucide-react";
import { createTimesheetRecord } from "../lib/dbClient";
import { Flex } from "./Flex";
import { Input } from "./Input";
import { Label } from "./Label";

export const CreateTimesheetRecord = ({
	timesheetId,
	projectRate,
	closed,
}: {
	timesheetId: string;
	projectRate: number;
	closed: boolean;
}) => {
	const queryClient = useQueryClient();
	const { mutate } = useMutation({
		mutationFn: async (formData: FormData) => {
			await createTimesheetRecord(formData);
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
			<Flex justify="between" items="center">
				<Flex gap={4}>
					<Flex direction="col" gap="2">
						<Label htmlFor="date">Date</Label>
						<Input
							name="date"
							type="date"
							defaultValue={format(new Date(), "yyyy-MM-dd")}
							required
						/>
					</Flex>
					<Flex direction="col" gap="2">
						<Label htmlFor="hours">Hours</Label>
						<Input
							name="hours"
							type="number"
							step="0.25"
							min="0.25"
							placeholder="Hours worked"
							required
						/>
						{/* <button type="button">
						<Timer />
						<TimerOff />
						</button> */}
					</Flex>
					<Flex direction="col" gap="2">
						<Label htmlFor="description">Description</Label>
						<Input name="description" placeholder="Work description" required />
					</Flex>
				</Flex>
				<div>
					<button
						type="submit"
						disabled={closed}
						className="disabled:bg-gray-300 disabled:cursor-not-allowed shrink-0 px-3 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
					>
						<PlusIcon className="h-4 w-4" />
					</button>
				</div>
			</Flex>
		</form>
	);
};
