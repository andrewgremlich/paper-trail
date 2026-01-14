import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Grid } from ".";

describe("Grid component", () => {
	it("renders with gap style", () => {
		const html = renderToStaticMarkup(
			<Grid cols={6} gap={8}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("<div");
		expect(html).toContain("child");
		expect(html).toContain("gap:8px");
	});

	it("renders children correctly", () => {
		const html = renderToStaticMarkup(
			<Grid cols={2}>
				<div>first</div>
				<div>second</div>
			</Grid>,
		);

		expect(html).toContain("first");
		expect(html).toContain("second");
	});

	it("applies templateCols via inline style when provided", () => {
		const html = renderToStaticMarkup(
			<Grid templateCols="repeat(3, minmax(0, 1fr))">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid-template-columns:repeat(3, minmax(0, 1fr))");
	});

	it("applies templateRows via inline style when provided", () => {
		const html = renderToStaticMarkup(
			<Grid templateRows="repeat(2, minmax(0, 1fr))">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid-template-rows:repeat(2, minmax(0, 1fr))");
	});

	it("applies rowGap via inline style", () => {
		const html = renderToStaticMarkup(
			<Grid rowGap={16}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("row-gap:16px");
	});

	it("applies columnGap via inline style", () => {
		const html = renderToStaticMarkup(
			<Grid columnGap="2rem">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("column-gap:2rem");
	});

	it("renders with custom element via as prop", () => {
		const html = renderToStaticMarkup(
			<Grid as="section" cols={2}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("<section");
		expect(html).toContain("</section>");
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<Grid className="custom-class" cols={2}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("custom-class");
	});

	it("passes through additional HTML attributes", () => {
		const html = renderToStaticMarkup(
			<Grid data-testid="test-grid" aria-label="Test grid">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain('data-testid="test-grid"');
		expect(html).toContain('aria-label="Test grid"');
	});
});
