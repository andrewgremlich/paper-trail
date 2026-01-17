import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Spinner } from "./index";

describe("Spinner", () => {
	it("renders svg element", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain("<svg");
	});

	it("has aria-hidden attribute for accessibility", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain('aria-hidden="true"');
	});

	it("renders circle element", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain("<circle");
	});

	it("renders path element", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain("<path");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(<Spinner className="custom-spinner" />);
		expect(html).toContain("custom-spinner");
	});

	it("has correct viewBox", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain('viewBox="0 0 24 24"');
	});

	it("has no fill on svg element", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain('fill="none"');
	});

	it("uses currentColor for stroke and fill", () => {
		const html = renderToStaticMarkup(<Spinner />);
		expect(html).toContain('stroke="currentColor"');
		expect(html).toContain('fill="currentColor"');
	});
});
