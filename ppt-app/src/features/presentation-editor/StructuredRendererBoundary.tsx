import { Component, type ErrorInfo, type ReactNode } from "react";

interface StructuredRendererBoundaryProps {
  resetKey: string;
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface StructuredRendererBoundaryState {
  error: Error | null;
  resetKey: string;
}

export class StructuredRendererBoundary extends Component<
  StructuredRendererBoundaryProps,
  StructuredRendererBoundaryState
> {
  state: StructuredRendererBoundaryState = {
    error: null,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromProps(
    props: StructuredRendererBoundaryProps,
    state: StructuredRendererBoundaryState,
  ): Partial<StructuredRendererBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<StructuredRendererBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}
