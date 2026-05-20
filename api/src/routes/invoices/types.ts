import { z } from "zod";
import type { InvoiceStatus } from "../../lib/types";

export const createInvoiceSchema = z
	.object({
		customerId: z.string().min(1),
		timesheetId: z.string().min(1).optional(),
		amountCents: z.number().int().positive().optional(),
		description: z.string().trim().max(5000).optional(),
		issuedAt: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
		dueDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
	})
	.refine(
		(v) =>
			v.timesheetId != null || (v.amountCents != null && v.amountCents > 0),
		{
			message: "Either timesheetId or amountCents (> 0) is required",
			path: ["amountCents"],
		},
	)
	.refine((v) => !v.issuedAt || !v.dueDate || v.dueDate >= v.issuedAt, {
		message: "dueDate must be on or after issuedAt",
		path: ["dueDate"],
	});

export type DbInvoiceRow = {
	id: string;
	userId: number;
	customerId: string;
	timesheetId: string | null;
	number: string;
	status: InvoiceStatus;
	amount_cents: string;
	description: string | null;
	issuedAt: string;
	dueDate: string;
	sentAt: string | null;
	paidAt: string | null;
	voidedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
};
