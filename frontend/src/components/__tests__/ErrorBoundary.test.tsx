import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@/components/ErrorBoundary';

function ThrowingChild({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

function GoodChild() {
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  // Suppress console.error from React's error boundary logging
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="kaboom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/encountered an error/)).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });

  it('includes portalName in the fallback heading', () => {
    render(
      <ErrorBoundary portalName="Staff Portal">
        <ThrowingChild message="fail" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Staff Portal encountered an error')).toBeInTheDocument();
  });

  it('defaults label to "This section" when portalName is not provided', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This section encountered an error')).toBeInTheDocument();
  });

  it('recovers when Try Again is clicked and child no longer throws', () => {
    let shouldThrow = true;
    function MaybeThrow() {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/encountered an error/)).toBeInTheDocument();

    // Fix the child, then click retry
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
