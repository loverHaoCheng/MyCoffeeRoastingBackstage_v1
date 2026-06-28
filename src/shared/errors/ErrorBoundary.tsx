import { Result } from 'antd';
import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

import { logger } from '@/shared/logger/logger';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React rendering failed', { error, errorInfo });
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          subTitle="页面渲染出现异常，请刷新后重试。"
          title="系统暂时不可用"
        />
      );
    }

    return this.props.children;
  }
}

