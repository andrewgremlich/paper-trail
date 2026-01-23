import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProjectModal } from "@/components/features/projects/ProjectModal";
import { SettingsModal } from "@/components/features/settings/SettingsModal";
import { TimesheetModal } from "@/components/features/timesheets/TimesheetModal";
import { Nav } from "@/components/layout/Nav";
import { PageWrapper } from "@/components/layout/PageWrapper";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
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

createRoot(rootElement).render(
	<StrictMode>
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
					<TimesheetModal />
					<ProjectModal />
					<SettingsModal />
					<PageWrapper>
						<Nav />
						<App />
					</PageWrapper>
				</ErrorBoundary>
			</ThemeProvider>
		</QueryClientProvider>
	</StrictMode>,
);
