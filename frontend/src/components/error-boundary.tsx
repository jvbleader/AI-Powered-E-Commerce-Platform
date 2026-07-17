"use client";
import { Component, ReactNode } from "react";
import { ErrorState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="mx-auto max-w-7xl px-4 py-8">
            <ErrorState
              title="Đã có lỗi xảy ra"
              description={this.state.error?.message || "Lỗi không xác định trong quá trình kết xuất."}
              action={
                <Button onClick={() => this.setState({ hasError: false, error: undefined })}>
                  Thử lại
                </Button>
              }
            />
          </div>
        )
      );
    }

    return this.props.children;
  }
}
