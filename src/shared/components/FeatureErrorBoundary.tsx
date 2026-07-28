import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  /** Optional feature name, woven into the default fallback copy. */
  featureName?: string;
  /** Optional custom fallback UI; overrides the default when provided. */
  fallback?: ReactNode;
  /** Optional pluggable reporter, called in addition to console.error. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class error boundary that scopes a thrown render error to one feature.
 * A crash in the wrapped subtree renders a local fallback instead of
 * blanking the whole app. Used to wrap each feature's
 * top-level routed component.
 */
export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): FeatureErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("FeatureErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      const where = this.props.featureName ? ` loading ${this.props.featureName}` : "";
      return (
        <div
          role="alert"
          className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center"
        >
          <h2 className="text-lg font-semibold text-destructive">Something went wrong{where}.</h2>
          <p className="text-sm text-muted-foreground">
            This section failed to load. Try refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
