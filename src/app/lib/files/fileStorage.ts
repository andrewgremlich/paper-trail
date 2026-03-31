import { api } from "../db/client";

export const saveAttachment = async (file: File): Promise<string> => {
	const formData = new FormData();
	formData.append("file", file);

	const result = await api.postFormData<{ key: string }>(
		"/files/upload",
		formData,
	);

	return result.key;
};

export const openAttachment = async (relPath: string): Promise<void> => {
	const isUrl = /^https?:\/\//i.test(relPath);

	if (isUrl) {
		window.open(relPath, "_blank");
	} else {
		// Open the file served from the API
		window.open(`/api/v1/files/${relPath}`, "_blank");
	}
};

export const removeAttachment = async (relPath: string): Promise<void> => {
	await api.delete(`/api/v1/files/${relPath}`);
};
