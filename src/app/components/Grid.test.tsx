import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Grid } from "./Grid";

describe("Grid component", () => {
	it("renders with mapped cols class and gap style", async () => {
		const html = renderToStaticMarkup(
			<Grid cols={6} gap={8}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid");
		expect(html).toContain("grid-cols-6");
		expect(html).toContain("w-full");
		// style attribute should include gap
		expect(html).toContain("gap:8px");
	});

	it("renders inline grid when inline is true", async () => {
		const html = renderToStaticMarkup(
			<Grid cols={2} inline>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("inline-grid");
		expect(html).not.toContain('grid ""grid');
	});

	it("applies templateCols via inline style when provided", async () => {
		const html = renderToStaticMarkup(
			<Grid templateCols="repeat(3, minmax(0, 1fr))">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid");
		expect(html).toContain("grid-template-columns:repeat(3, minmax(0, 1fr))");
	});

	it("applies templateRows via inline style when provided", async () => {
		const html = renderToStaticMarkup(
			<Grid templateRows="repeat(2, minmax(0, 1fr))">
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid");
		expect(html).toContain("grid-template-rows:repeat(2, minmax(0, 1fr))");
	});

	it("supports grid auto-flow direction classes", async () => {
		const htmlCol = renderToStaticMarkup(
			<Grid cols={2} flow="col">
				<div>child</div>
			</Grid>,
		);

		expect(htmlCol).toContain("grid-flow-col");

		const htmlRowDense = renderToStaticMarkup(
			<Grid cols={3} flow="row-dense">
				<div>child</div>
			</Grid>,
		);

		expect(htmlRowDense).toContain("grid-flow-row-dense");
	});

	it("renders with mapped rows class", async () => {
		const html = renderToStaticMarkup(
			<Grid rows={3}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid");
		expect(html).toContain("grid-rows-3");
	});

	it("supports combined cols and rows classes", async () => {
		const html = renderToStaticMarkup(
			<Grid cols={4} rows={2}>
				<div>child</div>
			</Grid>,
		);

		expect(html).toContain("grid-cols-4");
		expect(html).toContain("grid-rows-2");
	});
});
