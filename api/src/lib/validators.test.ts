import { describe, expect, it } from "vitest";
import {
	addressSchema,
	descriptionSchema,
	dollarAmountSchema,
	filePathSchema,
	isoDateSchema,
	moneyCentsSchema,
	positiveMoneyCentsSchema,
	shortNameSchema,
	uuidSchema,
} from "./validators";

describe("uuidSchema", () => {
	it("accepts a canonical UUID", () => {
		expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
	});

	it("rejects non-UUID strings", () => {
		expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
		expect(uuidSchema.safeParse("").success).toBe(false);
	});
});

describe("isoDateSchema", () => {
	it("accepts YYYY-MM-DD", () => {
		expect(isoDateSchema.safeParse("2026-05-16").success).toBe(true);
	});

	it("rejects other formats", () => {
		expect(isoDateSchema.safeParse("2026-5-16").success).toBe(false);
		expect(isoDateSchema.safeParse("16/05/2026").success).toBe(false);
		expect(isoDateSchema.safeParse("2026-05-16T00:00:00Z").success).toBe(false);
		expect(isoDateSchema.safeParse("").success).toBe(false);
	});
});

describe("moneyCentsSchema", () => {
	it("accepts negative, zero, and positive integers", () => {
		expect(moneyCentsSchema.safeParse(-100).success).toBe(true);
		expect(moneyCentsSchema.safeParse(0).success).toBe(true);
		expect(moneyCentsSchema.safeParse(12345).success).toBe(true);
	});

	it("rejects non-integers and non-finite numbers", () => {
		expect(moneyCentsSchema.safeParse(1.5).success).toBe(false);
		expect(moneyCentsSchema.safeParse(Number.NaN).success).toBe(false);
		expect(moneyCentsSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
		expect(moneyCentsSchema.safeParse("100").success).toBe(false);
	});
});

describe("positiveMoneyCentsSchema", () => {
	it("accepts non-negative integers", () => {
		expect(positiveMoneyCentsSchema.safeParse(0).success).toBe(true);
		expect(positiveMoneyCentsSchema.safeParse(1).success).toBe(true);
	});

	it("rejects negatives", () => {
		expect(positiveMoneyCentsSchema.safeParse(-1).success).toBe(false);
	});
});

describe("dollarAmountSchema", () => {
	it("accepts any finite number", () => {
		expect(dollarAmountSchema.safeParse(0).success).toBe(true);
		expect(dollarAmountSchema.safeParse(1.23).success).toBe(true);
		expect(dollarAmountSchema.safeParse(-9.99).success).toBe(true);
	});

	it("rejects non-finite numbers", () => {
		expect(dollarAmountSchema.safeParse(Number.NaN).success).toBe(false);
		expect(dollarAmountSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
	});
});

describe("descriptionSchema", () => {
	it("trims whitespace", () => {
		const r = descriptionSchema.safeParse("  hi  ");
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toBe("hi");
	});

	it("enforces a 5000-char ceiling", () => {
		expect(descriptionSchema.safeParse("a".repeat(5000)).success).toBe(true);
		expect(descriptionSchema.safeParse("a".repeat(5001)).success).toBe(false);
	});

	it("accepts empty string", () => {
		expect(descriptionSchema.safeParse("").success).toBe(true);
	});
});

describe("shortNameSchema", () => {
	it("requires at least one (post-trim) character", () => {
		expect(shortNameSchema.safeParse("").success).toBe(false);
		expect(shortNameSchema.safeParse("   ").success).toBe(false);
		expect(shortNameSchema.safeParse("a").success).toBe(true);
	});

	it("enforces a 200-char ceiling", () => {
		expect(shortNameSchema.safeParse("a".repeat(200)).success).toBe(true);
		expect(shortNameSchema.safeParse("a".repeat(201)).success).toBe(false);
	});
});

describe("addressSchema", () => {
	it("accepts empty and trims", () => {
		const r = addressSchema.safeParse("  123 Main  ");
		expect(r.success).toBe(true);
		if (r.success) expect(r.data).toBe("123 Main");
	});

	it("enforces a 1000-char ceiling", () => {
		expect(addressSchema.safeParse("x".repeat(1000)).success).toBe(true);
		expect(addressSchema.safeParse("x".repeat(1001)).success).toBe(false);
	});
});

describe("filePathSchema", () => {
	it("accepts a canonical UUID (internal R2 key)", () => {
		expect(
			filePathSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success,
		).toBe(true);
	});

	it("accepts http(s) URLs", () => {
		expect(filePathSchema.safeParse("https://example.com/x.pdf").success).toBe(true);
		expect(filePathSchema.safeParse("http://example.com/x.pdf").success).toBe(true);
	});

	it("accepts null and undefined", () => {
		expect(filePathSchema.safeParse(null).success).toBe(true);
		expect(filePathSchema.safeParse(undefined).success).toBe(true);
	});

	it("rejects non-http URL schemes", () => {
		expect(filePathSchema.safeParse("ftp://example.com/x").success).toBe(false);
		expect(filePathSchema.safeParse("javascript:alert(1)").success).toBe(false);
	});

	it("rejects bare relative paths", () => {
		expect(filePathSchema.safeParse("/etc/passwd").success).toBe(false);
		expect(filePathSchema.safeParse("not-a-uuid").success).toBe(false);
	});
});
