/**
 * Shared Zod primitives + foreign-key ownership helpers.
 *
 * Hand-typed JSON bodies don't validate runtime data — a caller can send
 * any shape and we'd happily encrypt + persist garbage. These primitives
 * are the building blocks the route handlers compose into per-endpoint
 * schemas.
 *
 * The `ownsX` helpers are deliberately tight: they SELECT 1 from the
 * referenced table with `userId = ?` so a row in another user's tenant
 * cannot be linked into the caller's data graph (it would be invisible
 * to the caller anyway, but accepting the write means a future feature
 * that joins tables differently could leak data across tenants).
 */
import { z } from "zod";
import { getDb } from "./db";
import type { Env } from "./types";

export const uuidSchema = z.string().uuid();

export const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const moneyCentsSchema = z.number().int().finite();
export const positiveMoneyCentsSchema = z.number().int().finite().nonnegative();
export const dollarAmountSchema = z.number().finite();

export const descriptionSchema = z.string().trim().max(5000);
export const shortNameSchema = z.string().trim().min(1).max(200);
export const addressSchema = z.string().trim().max(1000);

/**
 * `filePath` can be either an R2 UUID key (internal upload) or an
 * external https URL (legacy attachments). Everything else is rejected.
 */
export const filePathSchema = z
	.union([
		uuidSchema,
		z
			.string()
			.url()
			.regex(/^https?:\/\//i),
	])
	.nullable()
	.optional();

const ownsRow = async (
	env: Env,
	table: string,
	id: string,
	userId: number,
): Promise<boolean> => {
	const db = getDb(env);
	const row = await db
		.prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ? AND userId = ? LIMIT 1`)
		.bind(id, userId)
		.first<{ ok: number }>();
	return !!row?.ok;
};

export const userOwnsProject = (env: Env, id: string, userId: number) =>
	ownsRow(env, "projects", id, userId);

export const userOwnsTimesheet = (env: Env, id: string, userId: number) =>
	ownsRow(env, "timesheets", id, userId);

export const userOwnsCustomer = (env: Env, id: string, userId: number) =>
	ownsRow(env, "customers", id, userId);
