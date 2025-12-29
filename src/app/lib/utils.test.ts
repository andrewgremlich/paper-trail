import { describe, expect, it } from "vitest";
import { formatDate } from "./utils";

describe("formatDate", () => {
	it("formats date-only strings as local dates without previous-day shift", async () => {
		const input = "2025-12-29"; // naive ISO date-only
		const out = await Promise.resolve(
			formatDate(input, { format: "yyyy-MM-dd" }),
		);
		expect(out).toBe("2025-12-29");
	});

	it("returns empty string for invalid dates", async () => {
		const out = await Promise.resolve(formatDate("not-a-date"));
		expect(out).toBe("");
	});

	it("accepts Date instances unchanged", async () => {
		const d = new Date(2025, 11, 29); // Dec 29, 2025 local
		const out = await Promise.resolve(formatDate(d, { format: "yyyy-MM-dd" }));
		expect(out).toBe("2025-12-29");
	});

	it("accepts epoch milliseconds", async () => {
		const ms = new Date(2025, 11, 29).getTime();
		const out = await Promise.resolve(formatDate(ms, { format: "yyyy-MM-dd" }));
		expect(out).toBe("2025-12-29");
	});
});
