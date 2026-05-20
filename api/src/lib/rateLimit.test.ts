import { beforeEach, describe, expect, it } from "vitest";
import { generateDek, wrapDek } from "./crypto";
import { assertWithinSendLimit, RateLimitError } from "./rateLimit";
import type { Env } from "./types";

// In-memory rows shape mirrors the real `send_rate_log` table:
//   id (autoincrement), userId, recipientHash, sentAt (ISO string)
type Row = {
	id: number;
	userId: number;
	recipientHash: string | null;
	sentAt: string;
};

const makeFakeDb = (initialRows: Row[] = [], wrappedDek?: { wrapped: string; version: number }) => {
	const rows: Row[] = [...initialRows];
	let nextId = (rows.at(-1)?.id ?? 0) + 1;

	const prepare = (sql: string) => {
		const trimmed = sql.replace(/\s+/g, " ").trim();
		const binds: unknown[] = [];

		const api = {
			bind(...args: unknown[]) {
				binds.push(...args);
				return api;
			},
			async first<T = unknown>(): Promise<T | null> {
				if (trimmed.startsWith("SELECT wrappedDek, kekVersion FROM users")) {
					if (!wrappedDek) return null;
					return {
						wrappedDek: wrappedDek.wrapped,
						kekVersion: wrappedDek.version,
					} as T;
				}
				if (trimmed.startsWith("SELECT COUNT(*)")) {
					const [userId, sentAtCutoff] = binds as [number, string];
					const count = rows.filter(
						(r) => r.userId === userId && r.sentAt >= sentAtCutoff,
					).length;
					return { count } as T;
				}
				if (trimmed.startsWith("SELECT COUNT(DISTINCT recipientHash)")) {
					const [userId, sentAtCutoff, currentHash] = binds as [
						number,
						string,
						string,
					];
					const distinct = new Set<string>();
					for (const r of rows) {
						if (
							r.userId === userId &&
							r.sentAt >= sentAtCutoff &&
							r.recipientHash !== null &&
							r.recipientHash !== currentHash
						) {
							distinct.add(r.recipientHash);
						}
					}
					return { count: distinct.size } as T;
				}
				if (trimmed.startsWith("SELECT sentAt FROM send_rate_log")) {
					const [userId, sentAtCutoff] = binds as [number, string];
					const matches = rows
						.filter((r) => r.userId === userId && r.sentAt >= sentAtCutoff)
						.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
					return (matches[0] as unknown as T) ?? null;
				}
				return null;
			},
			async run() {
				if (trimmed.startsWith("DELETE FROM send_rate_log")) {
					const [userId, sentAtCutoff] = binds as [number, string];
					for (let i = rows.length - 1; i >= 0; i--) {
						if (rows[i].userId === userId && rows[i].sentAt < sentAtCutoff) {
							rows.splice(i, 1);
						}
					}
					return { meta: { changes: 0 } };
				}
				if (trimmed.startsWith("INSERT INTO send_rate_log")) {
					const [userId, recipientHash] = binds as [number, string | null];
					rows.push({
						id: nextId++,
						userId,
						recipientHash,
						sentAt: new Date().toISOString(),
					});
					return { meta: { last_row_id: nextId - 1 } };
				}
				return { meta: {} };
			},
		};
		return api;
	};

	return {
		db: { prepare } as unknown as D1Database,
		rows,
	};
};

const makeKey = (): string => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

const makeEnv = (db: D1Database, kekMaterial: string): Env =>
	({ DB: db, ENCRYPTION_KEY: kekMaterial }) as unknown as Env;

describe("assertWithinSendLimit", () => {
	let fake: ReturnType<typeof makeFakeDb>;
	let env: Env;

	beforeEach(async () => {
		const kekMaterial = makeKey();
		// Build an env with a KEK and wrap a freshly minted DEK under it
		// so the fake DB can hand it back when rateLimit calls
		// loadUserHmacKey(userId, env).
		const envForWrap = { ENCRYPTION_KEY: kekMaterial } as Env;
		const dekBytes = generateDek();
		const wrapped = await wrapDek(dekBytes, envForWrap);
		fake = makeFakeDb([], wrapped);
		env = makeEnv(fake.db, kekMaterial);
	});

	it("allows a send when the log is empty and records it", async () => {
		await assertWithinSendLimit(1, env);
		expect(fake.rows).toHaveLength(1);
		expect(fake.rows[0]).toMatchObject({ userId: 1, recipientHash: null });
	});

	it("hashes the recipient email when provided", async () => {
		await assertWithinSendLimit(1, env, "Buyer@Example.com");
		expect(fake.rows).toHaveLength(1);
		expect(fake.rows[0].recipientHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("normalizes recipient email (lowercase + trim) before hashing", async () => {
		await assertWithinSendLimit(1, env, "Buyer@Example.com");
		await assertWithinSendLimit(1, env, "  buyer@example.com  ");
		expect(fake.rows).toHaveLength(2);
		expect(fake.rows[0].recipientHash).toBe(fake.rows[1].recipientHash);
	});

	it("isolates rate limits per user", async () => {
		// Fill user 1 to the hourly cap
		const now = new Date().toISOString();
		for (let i = 0; i < 30; i++) {
			fake.rows.push({ id: i + 1, userId: 1, recipientHash: null, sentAt: now });
		}
		// user 2 unaffected
		await expect(assertWithinSendLimit(2, env)).resolves.toBeUndefined();
		// user 1 throws
		await expect(assertWithinSendLimit(1, env)).rejects.toBeInstanceOf(
			RateLimitError,
		);
	});

	it("throws RateLimitError with a positive retryAfter when at the hourly cap", async () => {
		const oldest = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30m ago
		for (let i = 0; i < 30; i++) {
			fake.rows.push({
				id: i + 1,
				userId: 1,
				recipientHash: null,
				sentAt: i === 0 ? oldest : new Date().toISOString(),
			});
		}
		try {
			await assertWithinSendLimit(1, env);
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(RateLimitError);
			const re = e as RateLimitError;
			expect(re.retryAfterSeconds).toBeGreaterThan(0);
			// ~30 minutes remaining
			expect(re.retryAfterSeconds).toBeLessThanOrEqual(60 * 60);
		}
	});

	it("does not record a new row when rate-limited", async () => {
		const now = new Date().toISOString();
		for (let i = 0; i < 30; i++) {
			fake.rows.push({ id: i + 1, userId: 1, recipientHash: null, sentAt: now });
		}
		const before = fake.rows.length;
		await expect(assertWithinSendLimit(1, env)).rejects.toBeInstanceOf(
			RateLimitError,
		);
		expect(fake.rows.length).toBe(before);
	});

	it("prunes rows older than 24h before counting", async () => {
		const ancient = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
		for (let i = 0; i < 30; i++) {
			fake.rows.push({ id: i + 1, userId: 1, recipientHash: null, sentAt: ancient });
		}
		await assertWithinSendLimit(1, env);
		// ancient rows pruned + one new row inserted
		expect(fake.rows.length).toBe(1);
	});

	it("blocks when 50 distinct recipients have been used in the last 24h", async () => {
		// 50 distinct recipients placed OUTSIDE the hourly window (so the
		// hourly cap isn't what trips), but INSIDE the 24h window.
		const olderThanHour = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		for (let i = 0; i < 50; i++) {
			fake.rows.push({
				id: i + 1,
				userId: 1,
				recipientHash: `hash_${i}`,
				sentAt: olderThanHour,
			});
		}
		await expect(
			assertWithinSendLimit(1, env, "new@example.com"),
		).rejects.toBeInstanceOf(RateLimitError);
	});

	it("does not count the current recipient against the distinct-recipient cap", async () => {
		// Stash 49 distinct OTHER recipients OUTSIDE the hourly window
		// (so they don't trip the per-hour cap of 30) but INSIDE the 24h window.
		const olderThanHour = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		for (let i = 0; i < 49; i++) {
			fake.rows.push({
				id: i + 1,
				userId: 1,
				recipientHash: `hash_${i}`,
				sentAt: olderThanHour,
			});
		}
		const target = "target@example.com";
		// First send to target: 49 OTHER distinct recipients (< 50) → ok.
		await assertWithinSendLimit(1, env, target);
		// Second send to SAME target: still 49 OTHER distinct (target excluded by
		// the != filter), so this should not be blocked by the recipient cap.
		await expect(
			assertWithinSendLimit(1, env, target),
		).resolves.toBeUndefined();
	});

	it("RateLimitError carries name + retryAfterSeconds", () => {
		const e = new RateLimitError(123);
		expect(e.name).toBe("RateLimitError");
		expect(e.retryAfterSeconds).toBe(123);
		expect(e).toBeInstanceOf(Error);
	});
});
