import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExportImportSection } from "./index";

describe("ExportImportSection", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	const wrapper = (component: React.ReactElement) => (
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
	);

	it("renders heading and description", () => {
		const html = renderToStaticMarkup(wrapper(<ExportImportSection />));
		expect(html).toContain("Backup &amp; Restore");
		expect(html).toContain("Export all your data to a JSON file");
	});

	it("renders export and import buttons", () => {
		const html = renderToStaticMarkup(wrapper(<ExportImportSection />));
		expect(html).toContain("Export Data");
		expect(html).toContain("Import Data");
	});
});
