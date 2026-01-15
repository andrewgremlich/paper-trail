import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SyncSettings } from "./index";

vi.mock("@/lib/db/syncConfig", () => ({
	getSyncConfig: vi.fn(() =>
		Promise.resolve({
			enableSync: false,
			isPaidFeature: false,
			syncUrl: "",
			authToken: "",
		}),
	),
	configureTursoSync: vi.fn(),
	disableSync: vi.fn(),
	syncNow: vi.fn(),
}));

describe("SyncSettings", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	const wrapper = (component: React.ReactElement) => (
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
	);

	it("renders loading state initially", () => {
		const html = renderToStaticMarkup(wrapper(<SyncSettings />));
		expect(html).toContain("Loading");
	});
});
