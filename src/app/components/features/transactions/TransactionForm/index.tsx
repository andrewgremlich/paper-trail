import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Project } from "@/lib/db";
import styles from "./styles.module.css";

interface TransactionFormProps {
	projects: Project[] | undefined;
	activeProjectId: number | null;
	onProjectChange: (projectId: number | null) => void;
	onSubmit: (formData: FormData) => void;
}

export const TransactionForm = ({
	projects,
	activeProjectId,
	onProjectChange,
	onSubmit,
}: TransactionFormProps) => {
	const handleSubmit = (evt: FormEvent<HTMLFormElement>) => {
		evt.preventDefault();
		onSubmit(new FormData(evt.currentTarget));
		evt.currentTarget.reset();
	};

	return (
		<Grid
			alignItems="end"
			cols={3}
			gap={12}
			as="form"
			onSubmit={handleSubmit}
			className={styles.form}
		>
			<Input
				label="Date"
				name="date"
				type="date"
				defaultValue={new Date().toISOString().split("T")[0]}
				required
			/>
			<Input label="Description" name="description" type="text" required />
			<Select
				label="Project"
				name="projectId"
				options={[
					{ value: "", label: "Select Project", disabled: true },
					...(projects?.map((project) => ({
						value: project.id,
						label: project.name,
					})) ?? []),
				]}
				onChange={(e) => {
					const projectId = e.currentTarget.value
						? Number.parseInt(e.currentTarget.value, 10)
						: null;
					onProjectChange(projectId);
				}}
				value={activeProjectId?.toString() ?? ""}
				required
			/>
			<Input label="Amount" name="amount" step="0.01" type="number" required />
			<Input label="File" name="file" type="file" />
			<Button type="submit" variant="default" size="sm">
				Add Transaction
			</Button>
		</Grid>
	);
};
