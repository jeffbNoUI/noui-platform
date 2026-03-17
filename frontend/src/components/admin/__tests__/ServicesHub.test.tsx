import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ServicesHub from '../ServicesHub';

vi.mock('../ServiceHealthDashboard', () => ({ default: () => <div>HealthPanel</div> }));
vi.mock('../DataQualityPanel', () => ({ default: () => <div>DQPanel</div> }));
vi.mock('../AuditTrailPanel', () => ({ default: () => <div>AuditPanel</div> }));
vi.mock('../OperationalMetricsPanel', () => ({ default: () => <div>MetricsPanel</div> }));
vi.mock('../SecurityAccessPanel', () => ({ default: () => <div>SecurityPanel</div> }));
vi.mock('../IssueManagementPanel', () => ({ default: () => <div>IssuesPanel</div> }));
vi.mock('../ConfigRulesPanel', () => ({ default: () => <div>ConfigPanel</div> }));

describe('ServicesHub', () => {
  it('renders all 7 tab buttons', () => {
    renderWithProviders(<ServicesHub />);
    expect(screen.getByRole('tab', { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /data quality/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /audit/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /issues/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /config/i })).toBeInTheDocument();
  });

  it('shows Health panel by default', () => {
    renderWithProviders(<ServicesHub />);
    expect(screen.getByText('HealthPanel')).toBeInTheDocument();
  });

  it('switches to Audit panel on tab click', () => {
    renderWithProviders(<ServicesHub />);
    fireEvent.click(screen.getByRole('tab', { name: /audit/i }));
    expect(screen.getByText('AuditPanel')).toBeInTheDocument();
    expect(screen.queryByText('HealthPanel')).not.toBeInTheDocument();
  });

  it('highlights active tab', () => {
    renderWithProviders(<ServicesHub />);
    const healthTab = screen.getByRole('tab', { name: /health/i });
    expect(healthTab).toHaveAttribute('aria-selected', 'true');
  });
});
