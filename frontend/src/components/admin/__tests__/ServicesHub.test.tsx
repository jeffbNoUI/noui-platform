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
vi.mock('lucide-react', () => {
  const icon = (name: string) => {
    const Icon = (props: Record<string, unknown>) => (
      <svg data-testid={`icon-${name}`} {...props} />
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    Heart: icon('Heart'),
    Database: icon('Database'),
    ScrollText: icon('ScrollText'),
    BarChart3: icon('BarChart3'),
    Shield: icon('Shield'),
    AlertCircle: icon('AlertCircle'),
    Settings: icon('Settings'),
  };
});

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

  it('renders tabpanel with aria-labelledby', () => {
    renderWithProviders(<ServicesHub />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'hub-tab-health');
  });

  it('updates tabpanel aria-labelledby on tab switch', () => {
    renderWithProviders(<ServicesHub />);
    fireEvent.click(screen.getByRole('tab', { name: /issues/i }));
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'hub-tab-issues');
  });

  it('all tabs have aria-label for accessibility', () => {
    renderWithProviders(<ServicesHub />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-label');
      expect(tab.getAttribute('aria-label')).not.toBe('');
    });
  });

  it('renders icons on all tabs', () => {
    renderWithProviders(<ServicesHub />);
    expect(screen.getByTestId('icon-Heart')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Database')).toBeInTheDocument();
    expect(screen.getByTestId('icon-ScrollText')).toBeInTheDocument();
    expect(screen.getByTestId('icon-BarChart3')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Shield')).toBeInTheDocument();
    expect(screen.getByTestId('icon-AlertCircle')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Settings')).toBeInTheDocument();
  });
});
