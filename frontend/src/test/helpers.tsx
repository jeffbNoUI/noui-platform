import { ReactNode, createElement } from 'react';
import { render } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Creates a fresh QueryClient with retries disabled for tests.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Renders a component wrapped in QueryClientProvider.
 */
export function renderWithProviders(ui: ReactNode) {
  const client = createTestQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * Renders a hook wrapped in QueryClientProvider.
 * Returns the renderHook result plus the QueryClient for cache assertions.
 */
export function renderHookWithProviders<T>(hook: () => T) {
  const client = createTestQueryClient();
  const result = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });
  return { ...result, queryClient: client };
}
