import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StripeSecretSection } from "./index";

describe("StripeSecretSection", () => {
	it("renders null placeholder", () => {
		const html = renderToStaticMarkup(<StripeSecretSection />);
		expect(html).toBe("");
	});
});
