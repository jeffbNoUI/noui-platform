import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/test/helpers';
import { useTemplatesByStage } from '@/hooks/useCorrespondenceTemplates';

const MOCK_TEMPLATES = [
  {
    id: 'tpl-1',
    templateName: 'Intake Acknowledgement',
    category: 'notification',
    stageCategory: 'intake',
    body: 'Dear {{member_name}}, your application has been received.',
    isActive: true,
  },
  {
    id: 'tpl-2',
    templateName: 'Employment Verification Request',
    category: 'request',
    stageCategory: 'intake',
    body: 'Please verify employment for {{member_name}}.',
    isActive: true,
  },
];

function setupFetch() {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/v1/correspondence/templates')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: MOCK_TEMPLATES,
            meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: null,
          meta: { request_id: 'test', timestamp: '2026-01-01T00:00:00Z' },
        }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useTemplatesByStage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = setupFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches templates filtered by stage category', async () => {
    const { result } = renderHookWithProviders(() => useTemplatesByStage('intake'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_TEMPLATES);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('stage_category=intake'),
      expect.any(Object),
    );
  });

  it('does not fetch when stageCategory is empty string', () => {
    const { result } = renderHookWithProviders(() => useTemplatesByStage(''));
    // enabled: stageCategory.length > 0 → query should not fire
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns loading state while fetching', () => {
    const { result } = renderHookWithProviders(() => useTemplatesByStage('eligibility'));
    expect(result.current.isLoading).toBe(true);
  });

  it('returns array data matching template shape', async () => {
    const { result } = renderHookWithProviders(() => useTemplatesByStage('intake'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].templateName).toBe('Intake Acknowledgement');
    expect(result.current.data![1].templateName).toBe('Employment Verification Request');
  });
});
