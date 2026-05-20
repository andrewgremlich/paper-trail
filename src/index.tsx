import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SignInGate } from "@/components/features/auth/SignInGate";
import { Nav } from "@/components/layout/Nav";
import { PageWrapper } from "@/components/layout/PageWrapper";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { ModalRenderer } from "@/components/shared/ModalRenderer";
import { App } from "@/index";
import { useTheme } from "@/lib/useTheme";

const queryClient = new QueryClient();

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
	useTheme();
	return <>{children}</>;
};

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Could not find root element with id 'root'");
}

// Vite exposes the publishable key at build time via import.meta.env.
// It's a public value (designed to be embedded in client bundles) so this
// is safe; the secret key stays on the Worker side.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
	throw new Error(
		"VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to .dev.vars (see docs/CLERK_AUTH.md).",
	);
}

createRoot(rootElement).render(
	<StrictMode>
		<ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<ErrorBoundary
						fallback={(error) => (
							<div className="error-boundary">
								<h2>Something went wrong:</h2>
								<pre>{error?.name}</pre>
								<pre>{error?.message}</pre>
								<pre>{error?.stack}</pre>
								<p>Restart the application.</p>
							</div>
						)}
					>
						<SignInGate>
							<ModalRenderer />
							<PageWrapper>
								<Nav />
								<App />
							</PageWrapper>
						</SignInGate>
					</ErrorBoundary>
				</ThemeProvider>
			</QueryClientProvider>
		</ClerkProvider>
	</StrictMode>,
);
