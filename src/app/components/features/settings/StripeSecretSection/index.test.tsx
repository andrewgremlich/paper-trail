import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StripeSecretSection } from "./index";

describe("StripeSecretSection", () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});

	const wrapper = (component: React.ReactElement) => (
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
	);

	it("renders Stripe Secret Key label", () => {
		const html = renderToStaticMarkup(
			wrapper(<StripeSecretSection active={true} />),
		);
		expect(html).toContain("Stripe Secret Key");
	});

	it("renders password input", () => {
		const html = renderToStaticMarkup(
			wrapper(<StripeSecretSection active={true} />),
		);
		expect(html).toContain('type="password"');
		expect(html).toContain('placeholder="sk_live_..."');
	});

	it("renders save button", () => {
		const html = renderToStaticMarkup(
			wrapper(<StripeSecretSection active={true} />),
		);
		expect(html).toContain("Save");
	});
});
