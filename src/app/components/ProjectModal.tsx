import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";
import { TrashIcon } from "lucide-react";
import { deleteProject, generateTimesheet, getProjectById } from "../lib/dbClient";
import { usePaperTrailStore } from "../lib/store";
import { CardContent, CardHeader } from "./Card";
import { CardPreview } from "./CardPreview";
import { Dialog } from "./Dialog";
import { H2, P, Section } from "./HtmlElements";
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
			await queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
		},
	});
	const { mutateAsync: mutateDeleteProject } = useMutation({
		mutationFn: async (formData: FormData) => {
			await deleteProject(formData);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
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
						<input type="hidden" name="id" value={project?.id} />
						<button
							className="hover:cursor-pointer p-2 rounded"
							type="submit"
							aria-label="Delete project"
						>
							<TrashIcon className="w-6 h-6 hover:text-blue-500" />
						</button>
					</form>
				</div>
				<P>
					Started:{" "}
					{project?.createdAt
						? new Date(project?.createdAt).toLocaleDateString()
						: "N/A"}
				</P>
				<P>Active: {project?.status}</P>
				<P>{project?.description}</P>
				<P>Rate: {project?.rate ? `$${project.rate}/hr` : "N/A"}</P>
				{project?.customerId && <P>Customer: {project?.customerId}</P>}
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
						<input type="hidden" name="projectId" value={project?.id} />
						<div className="grid gap-4 grid-cols-3">
							<div className="col-span-3">
								<Label htmlFor="name">Timesheet Name</Label>
								<div className="flex flex-row items-center">
									<input
										type="text"
										name="name"
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
									<button
										type="button"
										className="cursor-pointer ml-2 p-2 rounded hover:bg-gray-500"
										onClick={() => {
											dispatch({
												type: "set",
												field: "name",
												value: `${new Date().toLocaleDateString()} Timesheet`,
											});
										}}
									>
										Autogen Name
									</button>
								</div>
							</div>
							<div className="col-span-3">
								<Label htmlFor="description">Timesheet Description</Label>
								<input
									type="text"
									name="description"
									placeholder="Timesheet Description"
									className="flex h-10 rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-slate-500 text-slate-900"
									value={form.description}
									onChange={(e) =>
										dispatch({
											type: "set",
											field: "description",
											value: e.target.value,
										})
									}
								/>
							</div>
							<button
								type="submit"
								className="mt-2 p-2 bg-blue-500 text-white rounded grid-span-3 cursor-pointer"
							>
								Generate Timesheet
							</button>
						</div>
					</form>
				</Section>
			</CardContent>
		</Dialog>
	);
};
