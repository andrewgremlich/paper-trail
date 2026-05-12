import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./index";

vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		settingsModalActive: true,
		toggleSettingsModal: vi.fn(),
	}),
}));

describe("SettingsModal", () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	const renderComponent = () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		act(() => {
			createRoot(container).render(
				<QueryClientProvider client={queryClient}>
					<SettingsModal />
				</QueryClientProvider>,
			);
		});
		return document.body.innerHTML;
	};

	it("renders settings heading", () => {
		const html = renderComponent();
		expect(html).toContain("Settings");
	});

	it("renders description", () => {
		const html = renderComponent();
		expect(html).toContain("Modify settings for the application here.");
	});

	it("renders close button", () => {
		const html = renderComponent();
		expect(html).toContain("Close");
	});
});
