import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServiceMap from '../ServiceMap';

describe('ServiceMap', () => {
  it('renders service category headings', () => {
    render(<ServiceMap />);
    expect(screen.getByText('Workflow & Process')).toBeInTheDocument();
    expect(screen.getByText('Case Management')).toBeInTheDocument();
    expect(screen.getByText('Document Management')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
  });

  it('shows BUILD/HYBRID/BUY classification badges in catalog header', () => {
    render(<ServiceMap />);
    // The catalog header shows legend badges for all three classifications
    const buildBadges = screen.getAllByText('BUILD');
    expect(buildBadges.length).toBeGreaterThanOrEqual(1);
    const hybridBadges = screen.getAllByText('HYBRID');
    expect(hybridBadges.length).toBeGreaterThanOrEqual(1);
    const buyBadges = screen.getAllByText('BUY');
    expect(buyBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays summary statistics', () => {
    render(<ServiceMap />);
    // 31 total services across 10 categories
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('Total Services')).toBeInTheDocument();
    expect(screen.getByText('In POC')).toBeInTheDocument();
  });

  it('shows POC indicators for expanded category services', () => {
    render(<ServiceMap />);
    // 'Workflow & Process' is expanded by default, showing its services
    // Process Orchestrator appears in both architecture layers and service catalog
    const orchestrators = screen.getAllByText('Process Orchestrator');
    expect(orchestrators.length).toBeGreaterThanOrEqual(1);
    const pocLabels = screen.getAllByText('IN POC');
    expect(pocLabels.length).toBeGreaterThanOrEqual(1);
    // Task Scheduling has poc: false → 'DEFERRED'
    const deferredLabels = screen.getAllByText('DEFERRED');
    expect(deferredLabels.length).toBeGreaterThanOrEqual(1);
  });
});
