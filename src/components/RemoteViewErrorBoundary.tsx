import React from 'react';
import { Alert, Button } from 'antd';

class RemoteViewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RemoteView Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          type="error"
          message="Có lỗi xảy ra"
          description="Vui lòng tải lại trang hoặc liên hệ hỗ trợ."
          action={
            <Button type="primary" onClick={() => window.location.reload()}>
              Tải lại
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default RemoteViewErrorBoundary;