import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import RuleLogicRenderer from '../RuleLogicRenderer';
import type { RuleLogic } from '@/types/Rules';

describe('RuleLogicRenderer', () => {
  it('renders ConditionalRenderer for conditional type', () => {
    const logic: RuleLogic = {
      type: 'conditional',
      conditions: [{ condition: 'age >= 65', result: { eligible: true } }],
    };
    renderWithProviders(<RuleLogicRenderer logic={logic} />);
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('age >= 65')).toBeInTheDocument();
    expect(screen.getByText('THEN')).toBeInTheDocument();
  });

  it('renders FormulaRenderer for formula type', () => {
    const logic: RuleLogic = {
      type: 'formula',
      formula: 'benefit = ams * multiplier * years',
    };
    renderWithProviders(<RuleLogicRenderer logic={logic} />);
    expect(screen.getByText('benefit = ams * multiplier * years')).toBeInTheDocument();
  });

  it('renders LookupTableRenderer for lookup_table type', () => {
    const logic: RuleLogic = {
      type: 'lookup_table',
      table: [
        { key: 'tier_1', values: { multiplier: '2.0%', window: '36' } },
        { key: 'tier_2', values: { multiplier: '1.5%', window: '36' } },
      ],
    };
    renderWithProviders(<RuleLogicRenderer logic={logic} />);
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('tier_1')).toBeInTheDocument();
    expect(screen.getByText('2.0%')).toBeInTheDocument();
  });

  it('renders ProceduralRenderer for procedural type', () => {
    const logic: RuleLogic = {
      type: 'procedural',
      steps: ['Determine tier from hire date', 'Look up multiplier', 'Calculate benefit'],
    };
    renderWithProviders(<RuleLogicRenderer logic={logic} />);
    expect(screen.getByText('Determine tier from hire date')).toBeInTheDocument();
    expect(screen.getByText('Look up multiplier')).toBeInTheDocument();
    expect(screen.getByText('Calculate benefit')).toBeInTheDocument();
  });

  it('renders JSON fallback for unknown type', () => {
    const logic = { type: 'unknown' as RuleLogic['type'] };
    renderWithProviders(<RuleLogicRenderer logic={logic} />);
    expect(screen.getByText(/"type": "unknown"/)).toBeInTheDocument();
  });
});
