import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "./index";

describe("Input", () => {
	it("renders input element", () => {
		const html = renderToStaticMarkup(<Input />);
		expect(html).toContain("<input");
	});

	it("renders with label when provided", () => {
		const html = renderToStaticMarkup(<Input label="Email" />);
		expect(html).toContain("<label");
		expect(html).toContain("Email");
	});

	it("applies type attribute", () => {
		const html = renderToStaticMarkup(<Input type="email" />);
		expect(html).toContain('type="email"');
	});

	it("applies placeholder attribute", () => {
		const html = renderToStaticMarkup(<Input placeholder="Enter email" />);
		expect(html).toContain('placeholder="Enter email"');
	});

	it("applies required attribute", () => {
		const html = renderToStaticMarkup(<Input required />);
		expect(html).toContain("required");
	});

	it("applies disabled attribute", () => {
		const html = renderToStaticMarkup(<Input disabled />);
		expect(html).toContain("disabled");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(<Input className="custom-input" />);
		expect(html).toContain("custom-input");
	});

	it("applies aria-invalid when invalid is true", () => {
		const html = renderToStaticMarkup(<Input invalid />);
		expect(html).toContain('aria-invalid="true"');
	});

	it("defaults step to any for number inputs", () => {
		const html = renderToStaticMarkup(<Input type="number" />);
		expect(html).toContain('step="any"');
	});

	it("uses provided step over default for number inputs", () => {
		const html = renderToStaticMarkup(<Input type="number" step="0.01" />);
		expect(html).toContain('step="0.01"');
	});

	it("links label to input via htmlFor and id", () => {
		const html = renderToStaticMarkup(<Input label="Name" id="name-input" />);
		expect(html).toContain('for="name-input"');
		expect(html).toContain('id="name-input"');
	});

	it("applies min attribute", () => {
		const html = renderToStaticMarkup(<Input type="number" min={0} />);
		expect(html).toContain('min="0"');
	});

	it("applies aria-describedby when descriptionId provided", () => {
		const html = renderToStaticMarkup(<Input descriptionId="desc-id" />);
		expect(html).toContain('aria-describedby="desc-id"');
	});

	it("applies aria-describedby when errorId provided", () => {
		const html = renderToStaticMarkup(<Input errorId="error-id" />);
		expect(html).toContain('aria-describedby="error-id"');
	});
});
