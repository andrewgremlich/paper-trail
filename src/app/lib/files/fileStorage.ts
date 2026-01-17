import { documentDir, join } from "@tauri-apps/api/path";
import {
	BaseDirectory,
	exists,
	mkdir,
	remove,
	writeFile,
} from "@tauri-apps/plugin-fs";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import sanitize from "sanitize-filename";

export const saveAttachment = async (file: File, projectName: string) => {
	const relDir = `paper-trail/${sanitize(projectName)}/attachments`;
	const fname = `${crypto.randomUUID()}-${file.name}`;
	const relPath = `${relDir}/${fname}`;
	const hasDir = await exists(relDir, { baseDir: BaseDirectory.Document });

	if (!hasDir) {
		await mkdir(relDir, { baseDir: BaseDirectory.Document, recursive: true });
	}

	const buf = new Uint8Array(await file.arrayBuffer());

	await writeFile(relPath, buf, { baseDir: BaseDirectory.Document });

	return relPath;
};

export const resolveAttachmentPath = async (
	relPath: string,
): Promise<string> => {
	const base = await documentDir();
	return join(base, relPath);
};

export const openAttachment = async (relPath: string): Promise<void> => {
	const isUrl = /^https?:\/\//i.test(relPath);

	if (isUrl) {
		await openUrl(relPath);
	} else {
		const abs = await resolveAttachmentPath(relPath);
		await openPath(abs);
	}
};

export const removeAttachment = async (relPath: string): Promise<void> => {
	await remove(relPath, { baseDir: BaseDirectory.AppData });
};
