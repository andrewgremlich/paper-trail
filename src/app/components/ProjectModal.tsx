import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { useReducer } from "react";
import { deleteProject, generateTimesheet, getProjectById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { Button } from "./Button";
import { CardPreview } from "./CardPreview";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { H2, P, Section } from "./HtmlElements";
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

export const ProjectModal = () => {
	const [form, dispatch] = useReducer(formReducer, initialForm);
	const queryClient = useQueryClient();
	const {
		projectModalActive,
		toggleProjectModal,
		toggleTimesheetModal,
		activeProjectId,
	} = usePaperTrailStore();
	const { data: project } = useQuery({
		queryKey: ["project", activeProjectId],
		queryFn: () => {
			if (activeProjectId) {
				return getProjectById(activeProjectId);
			}
			return null;
		},
		enabled: !!activeProjectId,
	});
	const { mutateAsync: generateProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			await generateTimesheet(formData);
			await queryClient.invalidateQueries({
				queryKey: ["project", activeProjectId],
			});
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
		},
	});
	const { mutateAsync: mutateDeleteProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteProject(formData);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({ queryKey: ["timesheets"] });
			toggleProjectModal({ projectId: undefined });
		},
	});

	return (
		<Dialog
			className="px-10 py-8"
			variant="liquidGlass"
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
		>
			<Flex className="w-full" justify="between" items="start">
				<H2>{project?.name}</H2>
				<form
					onSubmit={async (evt) => {
						evt.preventDefault();
						const formData = new FormData(evt.currentTarget);
						await mutateDeleteProject(formData);
					}}
				>
					<input type="hidden" name="projectId" defaultValue={project?.id} />
					<Button variant="ghost" type="submit" aria-label="Delete project">
						<TrashIcon className="w-6 h-6 text-foreground" />
					</Button>
				</form>
			</Flex>
			<Flex gap={4} justify="between">
				<div>
					<P>
						Started:{" "}
						{project?.createdAt
							? new Date(project?.createdAt).toLocaleDateString()
							: "N/A"}
					</P>
					<P>
						Rate:{" "}
						{project?.rate_in_cents
							? `$${(project.rate_in_cents / 100).toFixed(2)}/hr`
							: "N/A"}
					</P>
					<P>Active: {project?.active ? "Yes" : "No"}</P>
				</div>
				<div>
					<P>{project?.description}</P>
					{project?.customerId && <P>Customer: {project?.customerId}</P>}
				</div>
			</Flex>
			{project?.timesheets && project.timesheets.length > 0 && (
				<div className="mb-6">
					<H2 className="mt-8 mb-4">Timesheets</H2>
					{project?.timesheets.map((timesheet) => (
						<CardPreview
							key={timesheet.id}
							name={timesheet.name}
							description={timesheet.description ?? "No description provided"}
							action={() => {
								toggleProjectModal({ projectId: undefined });
								toggleTimesheetModal({ timesheetId: timesheet.id });
							}}
						/>
					))}
				</div>
			)}
			<Section>
				<H2>Generate Timesheet for {project?.name}</H2>
				<form
					onSubmit={async (evt) => {
						evt.preventDefault();
						const formData = new FormData(evt.currentTarget);
						await generateProject(formData);
						dispatch({ type: "reset" });
					}}
				>
					<input type="hidden" name="projectId" defaultValue={project?.id} />
					<Flex gap={4} className="mb-4" items="end">
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
						containerClassName="col-span-3"
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
		</Dialog>
	);
};
