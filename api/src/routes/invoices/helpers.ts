import {
	decrypt,
	type EncryptionContext,
	encrypt,
	isEncryptionEnabled,
} from "../../lib/crypto";
import { getDb } from "../../lib/db";
import type { Env, Invoice, InvoiceSnapshot } from "../../lib/types";
import type { DbInvoiceRow } from "./types";

export const decryptInvoice = async (
	row: DbInvoiceRow,
	ctx: EncryptionContext,
	env: Env,
): Promise<Invoice> => {
	const amount = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount_cents, ctx))
		: Number(row.amount_cents);
	const description = row.description
		? await decrypt(row.description, ctx)
		: null;
	return {
		id: row.id,
		userId: row.userId,
		customerId: row.customerId,
		timesheetId: row.timesheetId,
		number: row.number,
		status: row.status,
		amount_cents: amount,
		description,
		issuedAt: row.issuedAt,
		dueDate: row.dueDate,
		sentAt: row.sentAt,
		paidAt: row.paidAt,
		voidedAt: row.voidedAt,
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
};

export const nextInvoiceNumber = async (
	userId: number,
	year: number,
	env: Env,
): Promise<string> => {
	const db = getDb(env);
	const prefix = `INV-${year}-`;
	// The highest existing seq for this user/year; lexicographic ordering of
	// zero-padded suffixes matches numeric ordering.
	const row = await db
		.prepare(
			`SELECT number FROM invoices
			 WHERE userId = ? AND number LIKE ?
			 ORDER BY number DESC LIMIT 1`,
		)
		.bind(userId, `${prefix}%`)
		.first<{ number: string }>();
	let nextSeq = 1;
	if (row?.number) {
		const tail = row.number.slice(prefix.length);
		const n = Number.parseInt(tail, 10);
		if (Number.isFinite(n)) nextSeq = n + 1;
	}
	return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

export const addDays = (iso: string, days: number): string => {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

export const logEvent = async (
	invoiceId: string,
	userId: number,
	type: "created" | "sent" | "paid" | "voided" | "viewed",
	payload: Record<string, unknown> | null,
	ctx: EncryptionContext,
	env: Env,
): Promise<void> => {
	const db = getDb(env);
	const encPayload = payload
		? await encrypt(JSON.stringify(payload), ctx)
		: null;
	await db
		.prepare(
			`INSERT INTO invoice_events (id, invoiceId, userId, type, payload)
			 VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(crypto.randomUUID(), invoiceId, userId, type, encPayload)
		.run();
};

export const buildSnapshot = async (
	row: DbInvoiceRow,
	ctx: EncryptionContext,
	env: Env,
): Promise<InvoiceSnapshot> => {
	const db = getDb(env);

	const user = await db
		.prepare(
			`SELECT email, venmoHandle, paypalHandle, businessName, businessAddress
			 FROM users WHERE id = ?`,
		)
		.bind(row.userId)
		.first<{
			email: string;
			venmoHandle: string | null;
			paypalHandle: string | null;
			businessName: string | null;
			businessAddress: string | null;
		}>();
	if (!user) throw new Error("User not found");

	const customer = await db
		.prepare(
			"SELECT name, email, address FROM customers WHERE id = ? AND userId = ?",
		)
		.bind(row.customerId, row.userId)
		.first<{ name: string; email: string; address: string | null }>();
	if (!customer) throw new Error("Customer not found");

	const businessName = user.businessName
		? await decrypt(user.businessName, ctx)
		: "";
	const businessAddress = user.businessAddress
		? await decrypt(user.businessAddress, ctx)
		: "";
	const venmoHandle = user.venmoHandle
		? await decrypt(user.venmoHandle, ctx)
		: null;
	const paypalHandle = user.paypalHandle
		? await decrypt(user.paypalHandle, ctx)
		: null;

	const lineItems: InvoiceSnapshot["lineItems"] = [];

	if (row.timesheetId) {
		const ts = await db
			.prepare(
				`SELECT p.rate_in_cents AS projectRate
				 FROM timesheets t JOIN projects p ON p.id = t.projectId
				 WHERE t.id = ? AND t.userId = ?`,
			)
			.bind(row.timesheetId, row.userId)
			.first<{ projectRate: string | number | null }>();
		const rate = ts
			? isEncryptionEnabled(env)
				? Number(await decrypt(String(ts.projectRate), ctx))
				: Number(ts.projectRate ?? 0)
			: 0;
		const { results: entries } = await db
			.prepare(
				`SELECT date, minutes, description FROM timesheet_entries
				 WHERE timesheetId = ? AND userId = ? ORDER BY date ASC`,
			)
			.bind(row.timesheetId, row.userId)
			.all<{ date: string; minutes: number; description: string }>();
		for (const e of entries) {
			lineItems.push({
				date: e.date,
				description: await decrypt(e.description, ctx),
				minutes: e.minutes,
				amountCents: rate ? Math.round((e.minutes * rate) / 60) : 0,
			});
		}
	}

	const amountCents = isEncryptionEnabled(env)
		? Number(await decrypt(row.amount_cents, ctx))
		: Number(row.amount_cents);
	const description = row.description
		? await decrypt(row.description, ctx)
		: null;

	return {
		seller: {
			businessName,
			businessAddress,
			email: user.email,
			venmoHandle,
			paypalHandle,
		},
		buyer: {
			name: await decrypt(customer.name, ctx),
			email: await decrypt(customer.email, ctx),
			address: customer.address ? await decrypt(customer.address, ctx) : null,
		},
		invoice: {
			number: row.number,
			id: row.id,
			issuedAt: row.issuedAt,
			dueDate: row.dueDate,
			description,
			amountCents,
		},
		lineItems,
	};
};
