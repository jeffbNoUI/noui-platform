import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollapsibleSection from '../CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders title text', () => {
    render(
      <CollapsibleSection title="My Section">
        <p>Content</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('defaults to collapsed — children hidden via grid-rows-[0fr]', () => {
    render(
      <CollapsibleSection title="Collapsed">
        <p>Hidden content</p>
      </CollapsibleSection>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // The grid wrapper uses 0fr to hide content
    const gridDiv = screen.getByText('Hidden content').closest('.grid');
    expect(gridDiv).toHaveStyle({ gridTemplateRows: '0fr' });
  });

  it('clicking toggle expands section — grid-rows-[1fr]', () => {
    render(
      <CollapsibleSection title="Toggle Me">
        <p>Expandable content</p>
      </CollapsibleSection>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const gridDiv = screen.getByText('Expandable content').closest('.grid');
    expect(gridDiv).toHaveStyle({ gridTemplateRows: '1fr' });
  });

  it('displays badge when provided', () => {
    render(
      <CollapsibleSection title="With Badge" badge={42}>
        <p>Content</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(
      <CollapsibleSection title="Pre-expanded" defaultExpanded>
        <p>Visible content</p>
      </CollapsibleSection>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const gridDiv = screen.getByText('Visible content').closest('.grid');
    expect(gridDiv).toHaveStyle({ gridTemplateRows: '1fr' });
  });
});
