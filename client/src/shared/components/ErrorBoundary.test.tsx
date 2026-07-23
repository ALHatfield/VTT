import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error
function ErrorThrowingComponent(): JSX.Element {
  throw new Error('Test error message');
}

// Component that works fine
function WorkingComponent(): JSX.Element {
  return <div>Working component</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('renders error UI when a child component throws', () => {
    // Suppress console.error for this test
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('shows detailed error in development mode', () => {
    // Suppress console.error for this test
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Ensure we're in dev mode
    vi.stubEnv('DEV', true);

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>,
    );

    // Should show error message in dev mode
    expect(screen.getByText(/test error message/i)).toBeInTheDocument();

    consoleError.mockRestore();
    vi.unstubAllEnvs();
  });
});
