import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Select } from "./index";

describe("Select", () => {
	it("renders select element", () => {
		const html = renderToStaticMarkup(<Select />);
		expect(html).toContain("<select");
	});

	it("renders with label when provided", () => {
		const html = renderToStaticMarkup(<Select label="Country" />);
		expect(html).toContain("<label");
		expect(html).toContain("Country");
	});

	it("renders options from options prop", () => {
		const html = renderToStaticMarkup(
			<Select
				options={[
					{ value: "us", label: "United States" },
					{ value: "ca", label: "Canada" },
				]}
			/>,
		);
		expect(html).toContain('value="us"');
		expect(html).toContain("United States");
		expect(html).toContain('value="ca"');
		expect(html).toContain("Canada");
	});

	it("renders disabled options", () => {
		const html = renderToStaticMarkup(
			<Select options={[{ value: "", label: "Select...", disabled: true }]} />,
		);
		expect(html).toContain("disabled");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(<Select className="custom-select" />);
		expect(html).toContain("custom-select");
	});

	it("applies aria-invalid when invalid is true", () => {
		const html = renderToStaticMarkup(<Select invalid />);
		expect(html).toContain('aria-invalid="true"');
	});

	it("links label to select via htmlFor and id", () => {
		const html = renderToStaticMarkup(<Select label="Type" id="type-select" />);
		expect(html).toContain('for="type-select"');
		expect(html).toContain('id="type-select"');
	});

	it("applies required attribute", () => {
		const html = renderToStaticMarkup(<Select required />);
		expect(html).toContain("required");
	});

	it("applies disabled attribute", () => {
		const html = renderToStaticMarkup(<Select disabled />);
		expect(html).toContain("disabled");
	});

	it("applies aria-describedby when descriptionId provided", () => {
		const html = renderToStaticMarkup(<Select descriptionId="desc-id" />);
		expect(html).toContain('aria-describedby="desc-id"');
	});

	it("applies aria-describedby when errorId provided", () => {
		const html = renderToStaticMarkup(<Select errorId="error-id" />);
		expect(html).toContain('aria-describedby="error-id"');
	});

	it("renders children as options", () => {
		const html = renderToStaticMarkup(
			<Select>
				<option value="test">Test Option</option>
			</Select>,
		);
		expect(html).toContain("Test Option");
	});
});
