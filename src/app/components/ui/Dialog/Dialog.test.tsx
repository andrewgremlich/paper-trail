import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { Dialog } from "./index";

const render = (ui: React.ReactElement) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	act(() => {
		createRoot(container).render(ui);
	});
	return document.body;
};

describe("Dialog", () => {
	it("renders dialog element with children", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}}>
				Dialog content
			</Dialog>,
		);
		expect(body.innerHTML).toContain("<dialog");
		expect(body.innerHTML).toContain("Dialog content");
	});

	it("applies solid variant by default", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}}>
				Content
			</Dialog>,
		);
		expect(body.innerHTML).toContain('data-variant="solid"');
	});

	it("applies aria-labelledby when titleId provided", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}} titleId="dialog-title">
				Content
			</Dialog>,
		);
		expect(body.innerHTML).toContain('aria-labelledby="dialog-title"');
	});

	it("applies aria-label when ariaLabel provided without titleId", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}} ariaLabel="Test dialog">
				Content
			</Dialog>,
		);
		expect(body.innerHTML).toContain('aria-label="Test dialog"');
	});

	it("applies custom className", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}} className="custom-class">
				Content
			</Dialog>,
		);
		expect(body.innerHTML).toContain("custom-class");
	});

	it("sets aria-modal true", () => {
		const body = render(
			<Dialog isOpen={false} onClose={() => {}}>
				Content
			</Dialog>,
		);
		expect(body.innerHTML).toContain('aria-modal="true"');
	});
});
