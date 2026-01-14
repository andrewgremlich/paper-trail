import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./index";

describe("Button", () => {
	it("renders children correctly", () => {
		const html = renderToStaticMarkup(<Button>Click me</Button>);
		expect(html).toContain("Click me");
	});

	it("renders as a button element", () => {
		const html = renderToStaticMarkup(<Button>Test</Button>);
		expect(html).toContain("<button");
		expect(html).toContain("</button>");
	});

	it("defaults to type button", () => {
		const html = renderToStaticMarkup(<Button>Button</Button>);
		expect(html).toContain('type="button"');
	});

	it("allows type to be overridden", () => {
		const html = renderToStaticMarkup(<Button type="submit">Submit</Button>);
		expect(html).toContain('type="submit"');
	});

	it("applies disabled attribute when disabled", () => {
		const html = renderToStaticMarkup(<Button disabled>Disabled</Button>);
		expect(html).toContain("disabled");
	});

	it("applies disabled attribute when isLoading is true", () => {
		const html = renderToStaticMarkup(<Button isLoading>Loading</Button>);
		expect(html).toContain("disabled");
	});

	it("renders left icon when provided", () => {
		const html = renderToStaticMarkup(
			<Button leftIcon={<span data-testid="left-icon">←</span>}>
				With Icon
			</Button>,
		);
		expect(html).toContain('data-testid="left-icon"');
		expect(html).toContain("←");
	});

	it("renders right icon when provided", () => {
		const html = renderToStaticMarkup(
			<Button rightIcon={<span data-testid="right-icon">→</span>}>
				With Icon
			</Button>,
		);
		expect(html).toContain('data-testid="right-icon"');
		expect(html).toContain("→");
	});

	it("hides left icon when isLoading is true", () => {
		const html = renderToStaticMarkup(
			<Button isLoading leftIcon={<span data-testid="left-icon">←</span>}>
				Loading
			</Button>,
		);
		expect(html).not.toContain('data-testid="left-icon"');
	});

	it("hides right icon when isLoading is true", () => {
		const html = renderToStaticMarkup(
			<Button isLoading rightIcon={<span data-testid="right-icon">→</span>}>
				Loading
			</Button>,
		);
		expect(html).not.toContain('data-testid="right-icon"');
	});

	it("applies custom className", () => {
		const html = renderToStaticMarkup(
			<Button className="custom-class">Custom</Button>,
		);
		expect(html).toContain("custom-class");
	});

	it("applies additional HTML attributes", () => {
		const html = renderToStaticMarkup(
			<Button data-testid="test-button" aria-label="Test button">
				Test
			</Button>,
		);
		expect(html).toContain('data-testid="test-button"');
		expect(html).toContain('aria-label="Test button"');
	});
});
