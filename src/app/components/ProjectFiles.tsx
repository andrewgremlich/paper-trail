import { documentDir, join as joinPath } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	readDir,
	readTextFile,
	remove,
	rename,
	writeFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sanitize from "sanitize-filename";
import { Button } from "./Button";
import { Card, CardContent, CardHeader } from "./Card";
import { Flex } from "./Flex";
import { Input } from "./Input";
import { Label } from "./Label";

type FileEntry = {
	name: string;
	isDirectory?: boolean;
	isFile?: boolean;
};

type Props = {
	projectName: string;
};

const TEXT_EXTENSIONS = [
	".txt",
	".md",
	".json",
	".csv",
	".log",
	".ts",
	".tsx",
	".js",
	".jsx",
	".css",
];

function isTextFile(name: string): boolean {
	const lower = name.toLowerCase();
	return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const ProjectFiles = ({ projectName }: Props) => {
	const folderName = useMemo(() => sanitize(projectName), [projectName]);
	const baseDirPath = `paper-trail/${folderName}`;

	const [files, setFiles] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [newFileName, setNewFileName] = useState("");
	const [newFileContent, setNewFileContent] = useState("");

	const [previewName, setPreviewName] = useState<string | null>(null);
	const [previewContent, setPreviewContent] = useState<string>("");
	const [renaming, setRenaming] = useState<string | null>(null);
	const [renameTo, setRenameTo] = useState<string>("");
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const splitExt = (name: string): { base: string; ext: string } => {
		const idx = name.lastIndexOf(".");
		if (idx <= 0) return { base: name, ext: "" };
		return { base: name.slice(0, idx), ext: name.slice(idx) };
	};

	const ensureUniqueName = async (rawName: string): Promise<string> => {
		const { base, ext } = splitExt(rawName);
		let candidate = rawName;
		let counter = 1;
		// Loop until we find a non-existing sanitized name
		for (;;) {
			const safe = sanitize(candidate);
			const existsAlready = await exists(`${baseDirPath}/${safe}`, {
				baseDir: BaseDirectory.Document,
			});
			if (!existsAlready) return safe;
			candidate = `${base} (${counter})${ext}`;
			counter += 1;
		}
	};

	const refresh = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			const entries = await readDir(baseDirPath, {
				baseDir: BaseDirectory.Document,
			});
			const normalized = entries
				.filter((e) => e.name !== null && e.name !== undefined)
				.map((e) => ({
					name: String(e.name),
					isDirectory: e.isDirectory,
					isFile: e.isFile,
				}));
			setFiles(normalized);
		} catch (err) {
			console.error(err);
			setError("Failed to read project directory");
		} finally {
			setLoading(false);
		}
	}, [baseDirPath]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const createTextFile = async (): Promise<void> => {
		const safeName = sanitize(newFileName.trim());
		if (!safeName) return;
		try {
			await writeTextFile(`${baseDirPath}/${safeName}`, newFileContent, {
				baseDir: BaseDirectory.Document,
			});
			setNewFileName("");
			setNewFileContent("");
			await refresh();
		} catch (err) {
			console.error(err);
			setError("Failed to create file");
		}
	};

	const deleteFile = async (name: string): Promise<void> => {
		try {
			await remove(`${baseDirPath}/${name}`, {
				baseDir: BaseDirectory.Document,
			});
			await refresh();
		} catch (err) {
			console.error(err);
			setError("Failed to delete file");
		}
	};

	const previewFile = async (name: string): Promise<void> => {
		setPreviewName(null);
		setPreviewContent("");
		if (!isTextFile(name)) {
			setPreviewName(name);
			setPreviewContent("Preview not available for this file type.");
			return;
		}
		try {
			const content = await readTextFile(`${baseDirPath}/${name}`, {
				baseDir: BaseDirectory.Document,
			});
			setPreviewName(name);
			setPreviewContent(content);
		} catch (err) {
			console.error(err);
			setError("Failed to read file");
		}
	};

	const startRename = (name: string): void => {
		setRenaming(name);
		setRenameTo(name);
	};

	const applyRename = async (): Promise<void> => {
		if (!renaming) return;
		const to = sanitize(renameTo.trim());
		if (!to) return;
		try {
			await rename(`${baseDirPath}/${renaming}`, `${baseDirPath}/${to}`, {
				oldPathBaseDir: BaseDirectory.Document,
				newPathBaseDir: BaseDirectory.Document,
			});
			setRenaming(null);
			setRenameTo("");
			await refresh();
		} catch (err) {
			console.error(err);
			setError("Failed to rename file");
		}
	};

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

	const handleFilesUpload = async (
		selected: FileList | null,
	): Promise<void> => {
		if (!selected || selected.length === 0) return;
		setUploading(true);
		setError(null);
		try {
			for (const file of Array.from(selected)) {
				const uniqueName = await ensureUniqueName(file.name);
				const buf = new Uint8Array(await file.arrayBuffer());
				await writeFile(`${baseDirPath}/${uniqueName}`, buf, {
					baseDir: BaseDirectory.Document,
				});
			}
			await refresh();
		} catch (err) {
			console.error(err);
			setError("Failed to upload files");
		} finally {
			setUploading(false);
		}
	};

	const onDrop = async (e: React.DragEvent<HTMLElement>): Promise<void> => {
		e.preventDefault();
		const files = e.dataTransfer?.files ?? null;
		await handleFilesUpload(files);
	};

	const onPick = async (
		e: React.ChangeEvent<HTMLInputElement>,
	): Promise<void> => {
		await handleFilesUpload(e.target.files);
		// Reset input so picking the same file again retriggers
		e.target.value = "";
	};

	return (
		<Card className="mb-6">
			<CardHeader>
				<Flex justify="between" items="center">
					<h3 className="text-lg font-semibold">{projectName}</h3>
					<Flex gap={2} items="center">
						<Button variant="secondary" onClick={() => void refresh()}>
							Refresh
						</Button>
					</Flex>
				</Flex>
			</CardHeader>
			<CardContent>
				{error ? <div className="mb-4 text-red-600">{error}</div> : null}

				<div className="mb-4">
					<h4 className="text-md mb-2 font-medium">Create Text File</h4>
					<Flex direction="col" gap={2}>
						<div>
							<Label htmlFor={`name-${folderName}`}>File name</Label>
							<Input
								id={`name-${folderName}`}
								value={newFileName}
								onChange={(e) => setNewFileName(e.target.value)}
								placeholder="e.g. notes.md"
							/>
						</div>
						<div>
							<Label htmlFor={`content-${folderName}`}>Content</Label>
							<textarea
								id={`content-${folderName}`}
								className="h-32 w-full rounded-md border border-input bg-white p-2 text-sm text-slate-900"
								value={newFileContent}
								onChange={(e) => setNewFileContent(e.target.value)}
								placeholder="Write something..."
							/>
						</div>
						<Flex>
							<Button onClick={() => void createTextFile()}>Create File</Button>
						</Flex>
					</Flex>
				</div>

				<div className="mb-4">
					<h4 className="text-md mb-2 font-medium">Upload Files</h4>
					<button
						onDragOver={(e) => {
							e.preventDefault();
						}}
						onDrop={(e) => void onDrop(e)}
						onClick={() => fileInputRef.current?.click()}
						type="button"
						className="flex h-28 w-full cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
					>
						<span>
							{uploading
								? "Uploading…"
								: "Drag & drop files here or click to choose"}
						</span>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							onChange={(e) => void onPick(e)}
							className="hidden"
						/>
					</button>
				</div>

				<div>
					<h4 className="text-md mb-2 font-medium">Files</h4>
					{loading ? (
						<div className="text-slate-600">Loading files…</div>
					) : files.length === 0 ? (
						<div className="text-slate-600">No files yet.</div>
					) : (
						<ul className="divide-y divide-slate-200 rounded-md border">
							{files.map((f) => (
								<li
									key={f.name}
									className="flex items-center justify-between p-2"
								>
									<Flex items="center" gap={2}>
										<span className="font-mono">{f.name}</span>
										{f.isDirectory ? (
											<span className="text-xs text-slate-500">(folder)</span>
										) : null}
									</Flex>
									<Flex items="center" gap={2}>
										{renaming === f.name ? (
											<>
												<Input
													value={renameTo}
													onChange={(e) => setRenameTo(e.target.value)}
													className="h-8"
												/>
												<Button
													variant="secondary"
													size="sm"
													onClick={() => void applyRename()}
												>
													Save
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setRenaming(null)}
												>
													Cancel
												</Button>
											</>
										) : (
											<>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => void previewFile(f.name)}
												>
													Preview
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => void openExternally(f.name)}
												>
													Open
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => startRename(f.name)}
												>
													Rename
												</Button>
												<Button
													variant="outline"
													size="sm"
													onClick={() => void deleteFile(f.name)}
												>
													Delete
												</Button>
											</>
										)}
									</Flex>
								</li>
							))}
						</ul>
					)}
				</div>

				{previewName ? (
					<div className="mt-4">
						<h4 className="text-md mb-2 font-medium">Preview: {previewName}</h4>
						<pre className="max-h-64 overflow-auto rounded-md border bg-slate-50 p-3 text-sm">
							{previewContent}
						</pre>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};

export default ProjectFiles;
