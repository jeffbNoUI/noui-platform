import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import NavigationModelPicker from '../NavigationModelPicker';

describe('NavigationModelPicker', () => {
  it('renders current model label in trigger button', () => {
    renderWithProviders(<NavigationModelPicker model="guided" onChange={() => {}} />);
    // "Guided" appears in both the trigger button and the dropdown option
    const guidedElements = screen.getAllByText('Guided');
    expect(guidedElements.length).toBe(2);
  });

  it('renders all four model options in dropdown', () => {
    renderWithProviders(<NavigationModelPicker model="guided" onChange={() => {}} />);
    expect(screen.getByText('Expert')).toBeInTheDocument();
    expect(screen.getByText('Deck')).toBeInTheDocument();
    expect(screen.getByText('Orbit')).toBeInTheDocument();
  });

  it('shows descriptions for each model', () => {
    renderWithProviders(<NavigationModelPicker model="guided" onChange={() => {}} />);
    expect(screen.getByText('Card stack with help panel')).toBeInTheDocument();
    expect(screen.getByText('All stages at once')).toBeInTheDocument();
    expect(screen.getByText('Stacked cards with parallax')).toBeInTheDocument();
    expect(screen.getByText('Three-zone layout')).toBeInTheDocument();
  });

  it('calls onChange when a model option is clicked', () => {
    const onChange = vi.fn();
    renderWithProviders(<NavigationModelPicker model="guided" onChange={onChange} />);
    fireEvent.click(screen.getByText('Deck'));
    expect(onChange).toHaveBeenCalledWith('deck');
  });

  it('highlights active model with background class', () => {
    const { container } = renderWithProviders(
      <NavigationModelPicker model="expert" onChange={() => {}} />,
    );
    const activeOption = container.querySelector('.bg-iw-sageLight\\/30');
    expect(activeOption).toBeInTheDocument();
  });
});
