import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 全局错误边界组件
 * 捕获子组件树中的 JavaScript 错误，记录错误信息，并显示降级 UI
 * 
 * @example
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 当子组件抛出错误时调用
   * 用于更新 state，以便下次渲染时显示降级 UI
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * 当子组件抛出错误时调用
   * 用于记录错误信息
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误到日志
    logger.error('[ErrorBoundary] 捕获到错误:', error);
    logger.error('[ErrorBoundary] 错误信息:', errorInfo);
    
    // 更新 state
    this.setState({
      error,
      errorInfo,
    });

    // 可以在这里将错误报告到错误监控服务
    // 例如：Sentry, LogRocket 等
    if (import.meta.env.PROD) {
      // 生产环境：发送错误到监控服务
      // reportErrorToService(error, errorInfo);
    }
  }

  /**
   * 重置错误状态
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * 重新加载页面
   */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级 UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h1 className="error-boundary-title">出错了</h1>
            <p className="error-boundary-message">
              应用遇到了一个错误。我们已经记录了这个问题，请尝试刷新页面。
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="error-boundary-details">
                <summary>错误详情（仅开发环境）</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button 
                className="error-boundary-button error-boundary-button-primary"
                onClick={this.handleReset}
              >
                重试
              </button>
              <button 
                className="error-boundary-button"
                onClick={this.handleReload}
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

