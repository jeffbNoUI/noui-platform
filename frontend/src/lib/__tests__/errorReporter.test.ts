import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError, _resetForTesting } from '../errorReporter';

describe('errorReporter', () => {
  const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

  beforeEach(() => {
    _resetForTesting();
    fetchSpy.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends error report via fetch', async () => {
    reportError({
      requestId: 'req-123',
      url: '/api/v1/members',
      httpStatus: 500,
      errorCode: 'DB_ERROR',
      errorMessage: 'connection refused',
      portal: 'staff',
      route: '/members',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toContain('/v1/errors/report');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.requestId).toBe('req-123');
    expect(body.errorCode).toBe('DB_ERROR');
  });

  it('skips reporting if URL is the error report endpoint', async () => {
    reportError({
      requestId: 'req-456',
      url: '/api/v1/errors/report',
      httpStatus: 500,
      errorCode: 'DB_ERROR',
      errorMessage: 'meta failure',
      portal: 'staff',
      route: '/members',
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw even if fetch fails', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    expect(() => {
      reportError({
        requestId: 'req-789',
        url: '/api/v1/members',
        httpStatus: 502,
        errorCode: 'GATEWAY_ERROR',
        errorMessage: 'bad gateway',
        portal: 'staff',
        route: '/members',
      });
    }).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
  });

  it('deduplicates identical errors within window', async () => {
    const error = {
      requestId: 'req-dup-1',
      url: '/api/v1/members',
      httpStatus: 500,
      errorCode: 'DB_ERROR',
      errorMessage: 'connection refused',
      portal: 'staff',
      route: '/members',
    };

    reportError(error);
    reportError({ ...error, requestId: 'req-dup-2' }); // same fingerprint

    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('includes componentStack when provided', async () => {
    reportError({
      requestId: 'req-crash',
      url: '',
      httpStatus: 0,
      errorCode: 'REACT_CRASH',
      errorMessage: 'null ref',
      portal: 'member',
      route: '/dashboard',
      componentStack: 'at Dashboard\nat ErrorBoundary',
    });

    await new Promise((r) => setTimeout(r, 10));

    const [, opts] = fetchSpy.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.errorCode).toBe('REACT_CRASH');
    expect(body.componentStack).toBe('at Dashboard\nat ErrorBoundary');
  });
});
