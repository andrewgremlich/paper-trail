import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { deleteTimesheet } from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { Button } from "./Button";
import { Input } from "./Input";

export const DeleteTimesheetIcon = ({
	timesheetId,
}: {
	timesheetId: number;
}) => {
	const queryClient = useQueryClient();
	const { toggleTimesheetModal } = usePaperTrailStore();

	const { mutate: mutateDeleteTimesheet } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteTimesheet(formData);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			toggleTimesheetModal({ timesheetId: undefined });
		},
	});

	return (
		<form
			onSubmit={async (evt) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget);
				await mutateDeleteTimesheet(formData);
			}}
		>
			<Input type="hidden" name="id" defaultValue={timesheetId} />
			<Button
				variant="ghost"
				size="icon"
				className="ml-2"
				type="submit"
				aria-label="Delete timesheet"
			>
				<TrashIcon className="w-6 h-6 text-primary-foreground" />
			</Button>
		</form>
	);
};
