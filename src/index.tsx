import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import ErrorBoundary from "@/components/ErrorBoundary";
import { Nav } from "@/components/Nav";
import { PageWrapper } from "@/components/PageWrapper";
import { ProjectModal } from "@/components/ProjectModal";
import { SettingsModal } from "@/components/SettingsModal";
import { TimesheetModal } from "@/components/TimesheetModal";
import { App } from "@/index";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Could not find root element with id 'root'");
}

createRoot(rootElement).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
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
				<TimesheetModal />
				<ProjectModal />
				<SettingsModal />
				<Nav />
				<PageWrapper>
					<App />
				</PageWrapper>
			</ErrorBoundary>
		</QueryClientProvider>
	</StrictMode>,
);
