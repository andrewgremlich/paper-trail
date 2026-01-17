import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditToggleButton } from ".";

describe("EditToggleButton component", () => {
	it("renders nothing when enabled is false", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton
				enabled={false}
				isEditing={false}
				onToggle={() => {}}
			/>,
		);

		expect(html).toBe("");
	});

	it("renders button when enabled is true (default)", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton isEditing={false} onToggle={() => {}} />,
		);

		expect(html).toContain("button");
		expect(html).toContain('aria-label="Edit"');
	});

	it("renders with custom aria-label", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton
				isEditing={false}
				onToggle={() => {}}
				ariaLabel="Toggle edit mode"
			/>,
		);

		expect(html).toContain('aria-label="Toggle edit mode"');
	});

	it("renders button when not editing", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton isEditing={false} onToggle={() => {}} />,
		);

		expect(html).toContain("button");
		expect(html).toContain('type="button"');
	});

	it("renders button when editing", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton isEditing={true} onToggle={() => {}} />,
		);

		expect(html).toContain("button");
		expect(html).toContain('type="button"');
	});

	it("renders Edit icon", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton isEditing={false} onToggle={() => {}} />,
		);

		expect(html).toContain("svg");
	});

	it("renders with icon class on svg element", () => {
		const html = renderToStaticMarkup(
			<EditToggleButton isEditing={false} onToggle={() => {}} />,
		);

		expect(html).toContain("editIcon");
	});
});
