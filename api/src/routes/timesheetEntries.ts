import { Hono } from "hono";
import { z } from "zod";
import { encrypt } from "../lib/crypto";
import { getDb } from "../lib/db";
import type { Env } from "../lib/types";
import {
	descriptionSchema,
	isoDateSchema,
	moneyCentsSchema,
	userOwnsTimesheet,
	uuidSchema,
} from "../lib/validators";
import type { AuthVariables } from "../middleware/auth";

const entryCreateSchema = z.object({
	timesheetId: uuidSchema,
	date: isoDateSchema,
	minutes: z.number().int().nonnegative(),
	description: descriptionSchema,
	amount: moneyCentsSchema,
});

const entryUpdateSchema = z.object({
	date: isoDateSchema,
	minutes: z.number().int().nonnegative(),
	description: descriptionSchema,
	amount: moneyCentsSchema,
});

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// POST /api/v1/timesheet-entries - create entry
app.post("/", async (c) => {
	const parsed = entryCreateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid timesheet entry", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	if (!(await userOwnsTimesheet(c.env, body.timesheetId, userId))) {
		return c.json({ error: "Timesheet not found" }, 404);
	}

	const encDescription = await encrypt(body.description, c.env);
	const encAmount = await encrypt(String(body.amount), c.env);
	const id = crypto.randomUUID();

	await db
		.prepare(
			`INSERT INTO timesheet_entries (id, timesheetId, date, minutes, description, amount, userId)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			body.timesheetId,
			body.date,
			body.minutes,
			encDescription,
			encAmount,
			userId,
		)
		.run();

	return c.json({ success: true, id }, 201);
});

// PUT /api/v1/timesheet-entries/:id - update entry
app.put("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = entryUpdateSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{ error: "Invalid timesheet entry", issues: parsed.error.issues },
			400,
		);
	}
	const body = parsed.data;
	const db = getDb(c.env);
	const userId = c.get("userId");

	const encDescription = await encrypt(body.description, c.env);
	const encAmount = await encrypt(String(body.amount), c.env);

	await db
		.prepare(
			`UPDATE timesheet_entries
			SET date = ?, minutes = ?, description = ?, amount = ?
			WHERE id = ? AND userId = ?`,
		)
		.bind(body.date, body.minutes, encDescription, encAmount, id, userId)
		.run();

	return c.json({ success: true });
});

// DELETE /api/v1/timesheet-entries/:id
app.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDb(c.env);
	const userId = c.get("userId");

	await db
		.prepare("DELETE FROM timesheet_entries WHERE id = ? AND userId = ?")
		.bind(id, userId)
		.run();

	return c.json({ success: true });
});

export { app as timesheetEntryRoutes };
