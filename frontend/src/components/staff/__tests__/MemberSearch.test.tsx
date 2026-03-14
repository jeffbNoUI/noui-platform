import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import MemberSearch from '../MemberSearch';
import type { MemberSearchResult } from '@/lib/memberSearchApi';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockResults: MemberSearchResult[] = [
  {
    memberId: 10001,
    firstName: 'Robert',
    lastName: 'Martinez',
    tier: 1,
    dept: 'Public Works',
    status: 'Active',
  },
  {
    memberId: 10002,
    firstName: 'Jennifer',
    lastName: 'Kim',
    tier: 2,
    dept: 'Finance',
    status: 'Active',
  },
];

// ── Mocks ────────────────────────────────────────────────────────────────────

let hookQuery = '';
let hookResults: MemberSearchResult[] = [];
let hookLoading = false;
const hookSetQuery = vi.fn();

vi.mock('@/hooks/useMemberSearch', () => ({
  useMemberSearch: () => ({
    query: hookQuery,
    setQuery: hookSetQuery,
    results: hookResults,
    loading: hookLoading,
    error: null,
  }),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MemberSearch', () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    hookQuery = '';
    hookResults = [];
    hookLoading = false;
    onSelect.mockClear();
    hookSetQuery.mockClear();
  });

  it('renders search input with placeholder', () => {
    renderWithProviders(<MemberSearch onSelect={onSelect} />);

    expect(screen.getByPlaceholderText(/Search by name/)).toBeInTheDocument();
  });

  it('calls setQuery when typing', () => {
    renderWithProviders(<MemberSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Search by name/);
    fireEvent.change(input, { target: { value: 'Robert' } });

    expect(hookSetQuery).toHaveBeenCalledWith('Robert');
  });

  it('renders search results as dropdown when query has results', () => {
    // Pre-set hook state with results, then render + focus to show dropdown
    hookQuery = 'Rob';
    hookResults = mockResults;
    renderWithProviders(<MemberSearch onSelect={onSelect} />);

    // Focus triggers showDropdown when query.length > 0
    const input = screen.getByPlaceholderText(/Search by name/);
    fireEvent.focus(input);

    expect(screen.getByText('Robert Martinez')).toBeInTheDocument();
    expect(screen.getByText('Jennifer Kim')).toBeInTheDocument();
    expect(screen.getByText(/2 results/)).toBeInTheDocument();
  });

  it('calls onSelect when clicking a result', () => {
    hookQuery = 'Rob';
    hookResults = mockResults;
    renderWithProviders(<MemberSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Search by name/);
    fireEvent.focus(input);

    fireEvent.click(screen.getByText('Robert Martinez'));
    expect(onSelect).toHaveBeenCalledWith(10001);
  });

  it('shows no-results message when query has no matches', () => {
    hookQuery = 'zzzzz';
    hookResults = [];
    hookLoading = false;
    renderWithProviders(<MemberSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Search by name/);
    fireEvent.focus(input);

    expect(screen.getByText(/No members found/)).toBeInTheDocument();
  });

  it('shows loading spinner when searching', () => {
    hookQuery = 'Rob';
    hookLoading = true;
    const { container } = renderWithProviders(<MemberSearch onSelect={onSelect} />);

    const input = screen.getByPlaceholderText(/Search by name/);
    fireEvent.focus(input);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
