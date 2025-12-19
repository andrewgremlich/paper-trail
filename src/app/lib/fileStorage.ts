import { appDataDir, join } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	mkdir,
	remove,
	writeFile,
} from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";

export const saveAttachment = async (file: File): Promise<string> => {
	const relDir = "attachments";
	const fname = `${crypto.randomUUID()}-${file.name}`;
	const relPath = `${relDir}/${fname}`;

	const hasDir = await exists(relDir, { baseDir: BaseDirectory.AppData });
	if (!hasDir) {
		await mkdir(relDir, { baseDir: BaseDirectory.AppData, recursive: true });
	}

	const buf = new Uint8Array(await file.arrayBuffer());
	await writeFile(relPath, buf, { baseDir: BaseDirectory.AppData });
	return relPath;
};

export const resolveAttachmentPath = async (
	relPath: string,
): Promise<string> => {
	const base = await appDataDir();
	return join(base, relPath);
};

export const openAttachment = async (relPath: string): Promise<void> => {
	const abs = await resolveAttachmentPath(relPath);
	await openPath(abs);
};

export const removeAttachment = async (relPath: string): Promise<void> => {
	await remove(relPath, { baseDir: BaseDirectory.AppData });
};
