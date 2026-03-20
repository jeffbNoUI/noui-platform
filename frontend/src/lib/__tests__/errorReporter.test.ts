import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock apiClient before importing errorReporter
vi.mock('../apiClient', () => ({
  postAPI: vi.fn().mockResolvedValue({}),
}));

import { reportError, _resetForTesting } from '../errorReporter';
import { postAPI } from '../apiClient';

const mockedPostAPI = vi.mocked(postAPI);

describe('errorReporter', () => {
  beforeEach(() => {
    _resetForTesting();
    mockedPostAPI.mockClear();
  });

  it('sends error report via postAPI', async () => {
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

    expect(mockedPostAPI).toHaveBeenCalledTimes(1);
    expect(mockedPostAPI).toHaveBeenCalledWith(
      expect.stringContaining('/v1/errors/report'),
      expect.objectContaining({
        requestId: 'req-123',
        errorCode: 'DB_ERROR',
      }),
    );
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
    expect(mockedPostAPI).not.toHaveBeenCalled();
  });

  it('does not throw even if postAPI fails', async () => {
    mockedPostAPI.mockRejectedValueOnce(new Error('network down'));

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
    expect(mockedPostAPI).toHaveBeenCalledTimes(1);
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

    expect(mockedPostAPI).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        errorCode: 'REACT_CRASH',
        componentStack: 'at Dashboard\nat ErrorBoundary',
      }),
    );
  });
});
