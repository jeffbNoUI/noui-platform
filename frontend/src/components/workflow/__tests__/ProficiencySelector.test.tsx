import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import ProficiencySelector from '../ProficiencySelector';

describe('ProficiencySelector', () => {
  it('renders all three proficiency levels', () => {
    renderWithProviders(<ProficiencySelector level="guided" onChange={() => {}} />);
    expect(screen.getByText('Guided')).toBeInTheDocument();
    expect(screen.getByText('Assisted')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('highlights the active level', () => {
    renderWithProviders(<ProficiencySelector level="assisted" onChange={() => {}} />);
    const assistedBtn = screen.getByText('Assisted').closest('button')!;
    expect(assistedBtn.className).toContain('bg-white');
  });

  it('calls onChange with selected level', () => {
    const onChange = vi.fn();
    renderWithProviders(<ProficiencySelector level="guided" onChange={onChange} />);
    fireEvent.click(screen.getByText('Expert'));
    expect(onChange).toHaveBeenCalledWith('expert');
  });

  it('shows descriptions as tooltips', () => {
    renderWithProviders(<ProficiencySelector level="guided" onChange={() => {}} />);
    const guidedBtn = screen.getByText('Guided').closest('button')!;
    expect(guidedBtn).toHaveAttribute('title', 'Full help & checklists');
  });
});
