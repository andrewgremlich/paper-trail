import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StripeSecretSection } from "./index";

vi.mock("@/lib/stripeApi", () => ({
	getStripeConnectStatus: vi.fn(),
	disconnectStripe: vi.fn(),
	getStripeConnectAuthorizeUrl: vi.fn(() => "/api/v1/stripe/connect/authorize"),
}));

const makeQueryClient = () =>
	new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

const renderComponent = (queryClient: QueryClient) =>
	renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<StripeSecretSection />
		</QueryClientProvider>,
	);

describe("StripeSecretSection", () => {
	it("renders loading state initially", () => {
		const queryClient = makeQueryClient();
		const html = renderComponent(queryClient);
		expect(html).toContain("Checking connection status");
	});

	it("renders Connect Stripe button when disconnected", async () => {
		const { getStripeConnectStatus } = await import("@/lib/stripeApi");
		vi.mocked(getStripeConnectStatus).mockResolvedValueOnce({
			connected: false,
		});

		const queryClient = makeQueryClient();
		queryClient.setQueryData(["stripe-connect-status"], { connected: false });

		const html = renderComponent(queryClient);
		expect(html).toContain("Connect Stripe");
		expect(html).not.toContain("Disconnect Stripe");
	});

	it("renders connected state with account ID and Disconnect button", async () => {
		const { getStripeConnectStatus } = await import("@/lib/stripeApi");
		vi.mocked(getStripeConnectStatus).mockResolvedValueOnce({
			connected: true,
			mode: "connect",
			stripeUserId: "acct_test123",
			stripePublishableKey: "pk_test_abc",
			scope: "read_write",
			connectedAt: "2024-01-15T00:00:00Z",
		});

		const queryClient = makeQueryClient();
		queryClient.setQueryData(["stripe-connect-status"], {
			connected: true,
			mode: "connect",
			stripeUserId: "acct_test123",
			stripePublishableKey: "pk_test_abc",
			scope: "read_write",
			connectedAt: "2024-01-15T00:00:00Z",
		});

		const html = renderComponent(queryClient);
		expect(html).toContain("acct_test123");
		expect(html).toContain("Disconnect Stripe");
		expect(html).not.toContain("Connect Stripe");
	});

	it("renders secret key mode when connected via API key", () => {
		const queryClient = makeQueryClient();
		queryClient.setQueryData(["stripe-connect-status"], {
			connected: true,
			mode: "secret_key",
		});

		const html = renderComponent(queryClient);
		expect(html).toContain("Connected via API key");
		expect(html).not.toContain("Disconnect Stripe");
	});
});
