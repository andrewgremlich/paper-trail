import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSection } from "./index";

describe("ThemeSection", () => {
	it("renders heading and description", () => {
		const html = renderToStaticMarkup(<ThemeSection />);
		expect(html).toContain("Appearance");
		expect(html).toContain("Choose your preferred color theme");
	});

	it("renders all theme options", () => {
		const html = renderToStaticMarkup(<ThemeSection />);
		expect(html).toContain("Light");
		expect(html).toContain("Dark");
		expect(html).toContain("System");
	});

	it("renders radio inputs for each theme option", () => {
		const html = renderToStaticMarkup(<ThemeSection />);
		expect(html).toContain('type="radio"');
		expect(html).toContain('name="theme"');
		expect(html).toContain('value="light"');
		expect(html).toContain('value="dark"');
		expect(html).toContain('value="system"');
	});
});
