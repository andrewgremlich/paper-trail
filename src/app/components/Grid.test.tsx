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
});
