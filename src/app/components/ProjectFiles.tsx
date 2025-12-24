import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentDir, join as joinPath } from "@tauri-apps/api/path";
import { BaseDirectory, readDir, remove } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useMemo, useState } from "react";
import sanitize from "sanitize-filename";
import { Button } from "./Button";
import { Card, CardContent, CardHeader } from "./Card";
import { Flex } from "./Flex";

type FileEntry = {
	name: string;
	isDirectory?: boolean;
	isFile?: boolean;
};

export const ProjectFiles = ({ projectName }: { projectName: string }) => {
	const queryClient = useQueryClient();
	const folderName = useMemo(() => sanitize(projectName), [projectName]);
	const baseDirPath = `paper-trail/${folderName}`;

	const [error, setError] = useState<string | null>(null);

	const filesQuery = useQuery({
		queryKey: ["project-files", folderName],
		queryFn: async () => {
			const entries = await readDir(baseDirPath, {
				baseDir: BaseDirectory.Document,
			});
			return (
				entries
					// Ensure name exists and ignore hidden files (dotfiles)
					.filter(
						(e) =>
							e.name !== null &&
							e.name !== undefined &&
							!String(e.name).startsWith("."),
					)
					.map((e) => ({
						name: String(e.name),
						isDirectory: e.isDirectory,
						isFile: e.isFile,
					})) as FileEntry[]
			);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (name: string) => {
			await remove(`${baseDirPath}/${name}`, {
				baseDir: BaseDirectory.Document,
				recursive: true,
			});
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["project-files", folderName],
			});
		},
		onError: () => {
			setError("Failed to delete file");
		},
	});

	const openExternally = async (name: string): Promise<void> => {
		try {
			const base = await documentDir();
			const abs = await joinPath(base, "paper-trail", folderName, name);
			await openPath(abs);
		} catch (err) {
			console.error(err);
			setError("Failed to open file externally");
		}
	};

	return (
		<Card className="mb-6">
			<CardHeader>
				<Flex justify="between" items="center">
					<h3 className="text-lg font-semibold">{projectName}</h3>
					<Button variant="secondary" onClick={() => filesQuery.refetch()}>
						Refresh
					</Button>
				</Flex>
			</CardHeader>
			<CardContent>
				{error ? <div className="mb-4 text-red-600">{error}</div> : null}
				{filesQuery.isError ? (
					<div className="mb-4 text-red-600">
						Failed to read project directory
					</div>
				) : null}

				<div>
					<h4 className="text-md mb-2 font-medium">Files</h4>
					{filesQuery.isLoading || filesQuery.isRefetching ? (
						<div className="text-slate-600">Loading files…</div>
					) : (filesQuery.data ?? []).length === 0 ? (
						<div className="text-slate-600">No files yet.</div>
					) : (
						<ul className="divide-y divide-slate-200 rounded-md border">
							{(filesQuery.data ?? []).map((f) => (
								<Flex
									as="li"
									items="center"
									justify="between"
									className="mx-4"
									key={f.name}
								>
									<Flex items="center" gap={2}>
										<span className="font-mono">{f.name}</span>
										{f.isDirectory ? (
											<span className="text-xs text-slate-500">(folder)</span>
										) : null}
									</Flex>
									<Flex items="center" gap={2}>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => openExternally(f.name)}
										>
											Open
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => deleteMutation.mutateAsync(f.name)}
										>
											Delete
										</Button>
									</Flex>
								</Flex>
							))}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export default ProjectFiles;
