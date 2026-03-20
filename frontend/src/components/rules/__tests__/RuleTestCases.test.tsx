import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleTestCases from '../RuleTestCases';
import type { RuleTestCase, TestStatus } from '@/types/Rules';

const MOCK_TEST_CASES: RuleTestCase[] = [
  {
    name: 'Normal retirement at 65',
    inputs: { age: 65, yearsOfService: 10 },
    expected: { eligible: true },
  },
  {
    name: 'Too young',
    description: 'Under minimum age',
    inputs: { age: 50, yearsOfService: 10 },
    expected: { eligible: false },
    demoCaseRef: 'CASE-002',
  },
];

const MOCK_STATUS: TestStatus = {
  total: 2,
  passing: 2,
  failing: 0,
  skipped: 0,
  lastRun: '2026-03-19T14:30:00Z',
};

describe('RuleTestCases', () => {
  it('renders test case names', () => {
    renderWithProviders(<RuleTestCases testCases={MOCK_TEST_CASES} />);
    expect(screen.getByText('Normal retirement at 65')).toBeInTheDocument();
    expect(screen.getByText('Too young')).toBeInTheDocument();
  });

  it('shows expected values', () => {
    renderWithProviders(<RuleTestCases testCases={MOCK_TEST_CASES} />);
    // "eligible" appears as a key in both test cases
    const eligibleLabels = screen.getAllByText('eligible');
    expect(eligibleLabels.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('true').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('false').length).toBeGreaterThanOrEqual(1);
  });

  it('renders demo case ref as clickable button', () => {
    const handleNavigate = vi.fn();
    renderWithProviders(
      <RuleTestCases testCases={MOCK_TEST_CASES} onNavigateToDemoCase={handleNavigate} />,
    );
    const refButton = screen.getByText('CASE-002');
    expect(refButton).toBeInTheDocument();
    fireEvent.click(refButton);
    expect(handleNavigate).toHaveBeenCalledWith('CASE-002');
  });

  it('shows test status summary when provided', () => {
    renderWithProviders(<RuleTestCases testCases={MOCK_TEST_CASES} testStatus={MOCK_STATUS} />);
    expect(screen.getByText('2 passing')).toBeInTheDocument();
  });

  it('shows empty state when no test cases', () => {
    renderWithProviders(<RuleTestCases testCases={[]} />);
    expect(screen.getByText('No test cases defined for this rule.')).toBeInTheDocument();
  });
});
