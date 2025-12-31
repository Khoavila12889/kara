// src/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from './logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="bg-red-900 text-white min-h-screen font-sans p-8">
          <h1 className="text-3xl font-bold mb-4">Đã có lỗi xảy ra.</h1>
          <p>Một lỗi không mong muốn đã xảy ra. Vui lòng thử tải lại trang.</p>
          <h2 className="text-xl font-semibold mt-6 mb-2">Chi tiết lỗi:</h2>
          <pre className="bg-gray-800 p-4 rounded-lg whitespace-pre-wrap text-lg">
            <code>
              {this.state.error?.toString()}
              <br />
              {this.state.error?.stack}
            </code>
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
