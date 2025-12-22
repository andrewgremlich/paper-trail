import * as React from "react";

function logErrorToMyService(
	error: Error,
	componentStack: string,
	ownerStack?: string,
) {
	console.error("Captured error:", error, { componentStack, ownerStack });
}

export interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback: React.ReactNode | ((error: Error | null) => React.ReactNode);
	onError?: (error: Error, info: React.ErrorInfo) => void;
	silent?: boolean;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { hasError: false, error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		if (this.props.onError) this.props.onError(error, info);

		if (!this.props.silent) {
			const maybeReact: unknown = React;
			let ownerStack: string | undefined;
			if (
				typeof maybeReact === "object" &&
				maybeReact !== null &&
				"captureOwnerStack" in maybeReact &&
				typeof (maybeReact as { captureOwnerStack?: () => unknown })
					.captureOwnerStack === "function"
			) {
				const val = (
					maybeReact as { captureOwnerStack: () => unknown }
				).captureOwnerStack();
				if (typeof val === "string") ownerStack = val;
			}
			logErrorToMyService(error, info.componentStack || "", ownerStack ?? "");
		}
	}

	private renderFallback() {
		const { fallback } = this.props;
		const { error } = this.state;
		if (typeof fallback === "function") return fallback(error);
		return fallback;
	}

	render() {
		if (this.state.hasError) {
			return this.renderFallback();
		}
		return this.props.children;
	}
}

export default ErrorBoundary;
