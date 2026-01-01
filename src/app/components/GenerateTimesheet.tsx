import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import {
	generateTimesheet,
	Nullable,
	type ProjectWithTimesheets,
} from "@/lib/db";
import { usePaperTrailStore } from "@/lib/store";
import { Button } from "./Button";
import { Flex } from "./Flex";
import { H2, Section } from "./HtmlElements";
import { Input } from "./Input";

type FormState = { name: string; description: string };
type FormAction =
	| { type: "set"; field: keyof FormState; value: string }
	| { type: "reset" };
const initialForm: FormState = { name: "", description: "" };

const formReducer = (state: FormState, action: FormAction): FormState => {
	switch (action.type) {
		case "set":
			return { ...state, [action.field]: action.value };
		case "reset":
			return initialForm;
		default:
			return state;
	}
};

export const GenerateTimesheet = ({
	project,
}: {
	project: ProjectWithTimesheets;
}) => {
	const queryClient = useQueryClient();
	const { activeProjectId } = usePaperTrailStore();
	const [form, dispatch] = useReducer(formReducer, initialForm);
	const { mutateAsync } = useMutation({
		mutationFn: async (formData: FormData) => {
			const projectId = Number(formData.get("projectId") || "");
			const name = String(formData.get("name") || "").trim();
			const description = (formData.get("description") ||
				"") as Nullable<string>;

			await generateTimesheet({ projectId, name, description });
			await queryClient.invalidateQueries({
				queryKey: ["project", activeProjectId],
			});
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
		},
	});

	return (
		<Section>
			<H2>Generate Timesheet for {project?.name}</H2>
			<form
				onSubmit={async (evt) => {
					evt.preventDefault();
					const formData = new FormData(evt.currentTarget);
					await mutateAsync(formData);
					dispatch({ type: "reset" });
				}}
			>
				<input type="hidden" name="projectId" defaultValue={project?.id} />
				<Flex gap={8} className="mb-4" items="end">
					<Input
						type="text"
						name="name"
						label="Timesheet Name"
						placeholder="Timesheet Name"
						required
						value={form.name}
						onChange={(e) =>
							dispatch({
								type: "set",
								field: "name",
								value: e.target.value,
							})
						}
					/>
					<Button
						variant="ghost"
						size="md"
						onClick={() => {
							dispatch({
								type: "set",
								field: "name",
								value: `${new Date().toLocaleDateString()} Timesheet`,
							});
						}}
					>
						Autogen Name
					</Button>
				</Flex>
				<Input
					type="text"
					name="description"
					placeholder="Timesheet Description"
					label="Timesheet Description"
					className="mb-6"
					value={form.description}
					onChange={(e) =>
						dispatch({
							type: "set",
							field: "description",
							value: e.target.value,
						})
					}
				/>
				<Button type="submit" variant="default" size="lg">
					Generate Timesheet
				</Button>
			</form>
		</Section>
	);
};
