import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./styles.module.css";

export const DeleteItem = ({
	deleteItemId,
	actionFn,
	successFn,
}: {
	deleteItemId: number;
	actionFn: (formData: FormData) => Promise<void>;
	successFn: () => void;
}) => {
	const queryClient = useQueryClient();

	const { mutate } = useMutation({
		mutationFn: actionFn,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			successFn();
		},
	});

	return (
		<form
			onSubmit={async (evt) => {
				evt.preventDefault();
				const formData = new FormData(evt.currentTarget);
				await mutate(formData);
			}}
		>
			<Input type="hidden" name="id" defaultValue={deleteItemId} />
			<Button
				variant="ghost"
				size="icon"
				className={styles.deleteButton}
				type="submit"
				aria-label="Delete timesheet"
			>
				<TrashIcon className={styles.trashIcon} />
			</Button>
		</form>
	);
};
