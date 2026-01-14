import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardContent, CardFooter } from "./index";

describe("Card Component", () => {
	it("renders Card component with content", () => {
		const html = renderToStaticMarkup(<Card>Card content</Card>);
		expect(html).toContain("Card content");
		expect(html).toContain("<div");
	});

	it("applies custom className to Card", () => {
		const html = renderToStaticMarkup(<Card className="custom-class">Test</Card>);
		expect(html).toContain("custom-class");
	});

	it("applies CSS module class to Card", () => {
		const html = renderToStaticMarkup(<Card>Test</Card>);
		expect(html).toContain('class="');
	});
});

describe("CardHeader Component", () => {
	it("renders CardHeader component with content", () => {
		const html = renderToStaticMarkup(<CardHeader>Header content</CardHeader>);
		expect(html).toContain("Header content");
		expect(html).toContain("<div");
	});

	it("applies custom className to CardHeader", () => {
		const html = renderToStaticMarkup(<CardHeader className="custom-header">Header</CardHeader>);
		expect(html).toContain("custom-header");
	});

	it("applies CSS module class to CardHeader", () => {
		const html = renderToStaticMarkup(<CardHeader>Test</CardHeader>);
		expect(html).toContain('class="');
	});
});

describe("CardContent Component", () => {
	it("renders CardContent component with content", () => {
		const html = renderToStaticMarkup(<CardContent>Content text</CardContent>);
		expect(html).toContain("Content text");
		expect(html).toContain("<div");
	});

	it("applies custom className to CardContent", () => {
		const html = renderToStaticMarkup(<CardContent className="custom-content">Content</CardContent>);
		expect(html).toContain("custom-content");
	});

	it("applies CSS module class to CardContent", () => {
		const html = renderToStaticMarkup(<CardContent>Test</CardContent>);
		expect(html).toContain('class="');
	});
});

describe("CardFooter Component", () => {
	it("renders CardFooter component with content", () => {
		const html = renderToStaticMarkup(<CardFooter>Footer content</CardFooter>);
		expect(html).toContain("Footer content");
		expect(html).toContain("<div");
	});

	it("applies custom className to CardFooter", () => {
		const html = renderToStaticMarkup(<CardFooter className="custom-footer">Footer</CardFooter>);
		expect(html).toContain("custom-footer");
	});

	it("applies CSS module class to CardFooter", () => {
		const html = renderToStaticMarkup(<CardFooter>Test</CardFooter>);
		expect(html).toContain('class="');
	});
});

describe("Card Component Integration", () => {
	it("renders complete card with all sub-components", () => {
		const html = renderToStaticMarkup(
			<Card>
				<CardHeader>Title</CardHeader>
				<CardContent>Main content</CardContent>
				<CardFooter>Actions</CardFooter>
			</Card>,
		);

		expect(html).toContain("Title");
		expect(html).toContain("Main content");
		expect(html).toContain("Actions");
	});
});
