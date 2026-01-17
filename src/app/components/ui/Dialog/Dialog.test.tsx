import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Dialog } from "./index";

describe("Dialog", () => {
	it("renders dialog element with children", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}}>
				Dialog content
			</Dialog>,
		);
		expect(html).toContain("<dialog");
		expect(html).toContain("Dialog content");
	});

	it("applies solid variant by default", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}}>
				Content
			</Dialog>,
		);
		expect(html).toContain('data-variant="solid"');
	});

	it("applies liquidGlass variant when specified", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} variant="liquidGlass">
				Content
			</Dialog>,
		);
		expect(html).toContain('data-variant="liquidGlass"');
	});

	it("applies aria-labelledby when titleId provided", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} titleId="dialog-title">
				Content
			</Dialog>,
		);
		expect(html).toContain('aria-labelledby="dialog-title"');
	});

	it("applies aria-label when ariaLabel provided without titleId", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} ariaLabel="Test dialog">
				Content
			</Dialog>,
		);
		expect(html).toContain('aria-label="Test dialog"');
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} className="custom-class">
				Content
			</Dialog>,
		);
		expect(html).toContain("custom-class");
	});

	it("sets aria-modal true when modal prop is true", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} modal>
				Content
			</Dialog>,
		);
		expect(html).toContain('aria-modal="true"');
	});

	it("does not set aria-modal when modal is false", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} modal={false}>
				Content
			</Dialog>,
		);
		expect(html).not.toContain("aria-modal");
	});

	it("applies animate class when animate is true", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} animate>
				Content
			</Dialog>,
		);
		expect(html).toContain("class=");
	});

	it("applies transition duration style when animate is true", () => {
		const html = renderToStaticMarkup(
			<Dialog isOpen={false} onClose={() => {}} animate animationDuration={200}>
				Content
			</Dialog>,
		);
		expect(html).toContain("200ms");
	});
});
