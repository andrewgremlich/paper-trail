import { api } from "./client";
import type { Attachment, AttachmentSummary } from "./types";

export const getAttachments = (): Promise<Attachment[]> =>
	api.get<Attachment[]>("/attachments");

export const getAttachmentSummary = (): Promise<AttachmentSummary> =>
	api.get<AttachmentSummary>("/attachments/summary");

export const deleteAttachment = (key: string): Promise<void> =>
	api.delete(`/files/${key}`);
