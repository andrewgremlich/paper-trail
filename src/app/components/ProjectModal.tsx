import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TrashIcon } from "lucide-react";
import { useReducer } from "react";
import { deleteProject, generateTimesheet, getProjectById } from "../lib/db";
import { usePaperTrailStore } from "../lib/store";
import { Button } from "./Button";
import { CardContent, CardHeader } from "./Card";
import { CardPreview } from "./CardPreview";
import { Dialog } from "./Dialog";
import { Flex } from "./Flex";
import { H2, P, Section } from "./HtmlElements";
import { Input } from "./Input";
import { Label } from "./Label";

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
			isOpen={projectModalActive}
			onClose={() => toggleProjectModal({ projectId: undefined })}
		>
			<CardHeader>
				<div className="w-full flex justify-between items-start">
					<H2>{project?.name}</H2>
					<form
						onSubmit={async (evt) => {
							evt.preventDefault();
							const formData = new FormData(evt.currentTarget);
							await mutateDeleteProject(formData);
						}}
					>
						<input type="hidden" name="projectId" defaultValue={project?.id} />
						<button
							className="hover:cursor-pointer p-2 rounded"
							type="submit"
							aria-label="Delete project"
						>
							<TrashIcon className="w-6 h-6 hover:text-blue-500" />
						</button>
					</form>
				</div>
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
			</CardHeader>
			<CardContent>
				<div className="mb-6">
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
				<hr />
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
								className="flex h-10 rounded-md border border-input bg-white px-3 text-sm placeholder:text-slate-500 text-slate-900"
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
							className="flex h-10 rounded-md border border-input bg-white px-3 py-2 mb-6 text-sm placeholder:text-slate-500 text-slate-900"
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
			</CardContent>
		</Dialog>
	);
};
