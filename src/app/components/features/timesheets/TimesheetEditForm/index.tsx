import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import { updateTimesheet } from "@/lib/db";
import type { TimesheetDetails } from "@/lib/db/types";
import styles from "./styles.module.css";

type TimesheetEditFormProps = {
	timesheet: TimesheetDetails;
	onSaved?: () => void;
};

export const TimesheetEditForm = ({
	timesheet,
	onSaved,
}: TimesheetEditFormProps) => {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async (formData: FormData) => {
			return await updateTimesheet({
				id: timesheet.id,
				name: String(formData.get("name") || ""),
				description: String(formData.get("description") || ""),
				active: timesheet.active,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["timesheet", timesheet.id],
			});
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			onSaved?.();
		},
	});

	return (
		<Grid
			className={styles.timesheetEditForm}
			as="form"
			cols={2}
			gap={6}
			onSubmit={async (evt: FormEvent<HTMLElement>) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget as HTMLFormElement);
				await mutation.mutateAsync(formData);
			}}
		>
			<Input name="name" label="Name" defaultValue={timesheet?.name || ""} />
			<Input
				name="description"
				label="Description"
				defaultValue={timesheet?.description || ""}
			/>
			<Button type="submit" className={styles.submitButton} size="sm">
				Save Changes
			</Button>
		</Grid>
	);
};
