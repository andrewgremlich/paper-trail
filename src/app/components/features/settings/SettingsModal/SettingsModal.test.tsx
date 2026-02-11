import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsModal } from "./index";

vi.mock("@/lib/store", () => ({
	usePaperTrailStore: () => ({
		settingsModalActive: true,
		toggleSettingsModal: vi.fn(),
	}),
}));

vi.mock("@/lib/stronghold", () => ({
	getStripeSecretKey: vi.fn(() => Promise.resolve(null)),
	setStripeSecretKey: vi.fn(),
}));

describe("SettingsModal", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	const wrapper = (component: React.ReactElement) => (
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
	);

	it("renders settings heading", () => {
		const html = renderToStaticMarkup(wrapper(<SettingsModal />));
		expect(html).toContain("Settings");
	});

	it("renders description", () => {
		const html = renderToStaticMarkup(wrapper(<SettingsModal />));
		expect(html).toContain("Modify settings for the application here.");
		expect(html).toContain("Stripe Secret Key");
	});

	it("renders close button", () => {
		const html = renderToStaticMarkup(wrapper(<SettingsModal />));
		expect(html).toContain("Close");
	});
});
