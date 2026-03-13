import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SyncSettings } from "./index";

describe("SyncSettings", () => {
	it("renders nothing (removed in web version)", () => {
		const html = renderToStaticMarkup(<SyncSettings />);
		expect(html).toBe("");
	});
});
