import React, { Component, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary to catch React component errors
 * Shows fallback UI with error details in development
 * Shows generic message in production
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] React error caught:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <h1 className={styles.title}>😵 Something went wrong</h1>

            <p className={styles.message}>
              {isDev
                ? 'A React component error occurred. Check the details below.'
                : 'An unexpected error occurred. Please refresh the page.'}
            </p>

            {isDev && this.state.error && (
              <div className={styles.errorDetails}>
                <h2>Error Message</h2>
                <pre className={styles.errorMessage}>
                  {this.state.error.toString()}
                </pre>

                {this.state.errorInfo && (
                  <>
                    <h2>Component Stack</h2>
                    <pre className={styles.componentStack}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.button} onClick={this.handleReset}>
                Try Again
              </button>
              <button className={styles.buttonSecondary} onClick={this.handleReload}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
