import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeSlotCard from './TimeSlotCard';

describe('TimeSlotCard', () => {
  const defaultProps = {
    slot: {
      id: 't1',
      startTime: '2026-10-10T10:00:00Z',
      endTime: '2026-10-10T11:00:00Z',
    },
    value: 'BLANK' as const,
    onChange: vi.fn(),
  };

  it('renders date and time range correctly', () => {
    render(<TimeSlotCard {...defaultProps} />);
    const start = new Date(defaultProps.slot.startTime);
    const end = new Date(defaultProps.slot.endTime);
    const expectedDate = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const expectedStart = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const expectedEnd = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    expect(screen.getByText(new RegExp(expectedDate.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(expectedStart.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(expectedEnd.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
  });

  it('exposes the three options as a radiogroup with radio roles', () => {
    render(<TimeSlotCard {...defaultProps} />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'If need be' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No' })).toBeInTheDocument();
  });

  it('marks no radio as checked and shows "No selection" in the BLANK state', () => {
    render(<TimeSlotCard {...defaultProps} value="BLANK" />);
    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    });
    expect(screen.getByText('No selection')).toBeInTheDocument();
  });

  it('marks the matching radio as checked for a selected value', () => {
    render(<TimeSlotCard {...defaultProps} value="YES" />);
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'If need be' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'No' })).toHaveAttribute('aria-checked', 'false');
  });

  it('displays BLANK state styling by default', () => {
    render(<TimeSlotCard {...defaultProps} />);
    const card = screen.getByTestId('slot-card');
    expect(card).toHaveClass('bg-neutral-50');
    expect(card).toHaveClass('text-brand-charcoal');
  });

  it('calls onChange with YES when the card body is clicked from BLANK state', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('slot-card'));
    expect(onChange).toHaveBeenCalledWith('YES');
  });

  it('calls onChange with BLANK when the card body is clicked from NO state', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} value="NO" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('slot-card'));
    expect(onChange).toHaveBeenCalledWith('BLANK');
  });

  it('displays YES state styling and always shows all three icons', () => {
    render(<TimeSlotCard {...defaultProps} value="YES" />);
    const card = screen.getByTestId('slot-card');
    expect(card).toHaveClass('bg-brand-green-light/40');
    expect(card.querySelectorAll('svg').length).toBe(3);
  });

  it('displays IF_NEED_BE state styling and always shows all three icons', () => {
    render(<TimeSlotCard {...defaultProps} value="IF_NEED_BE" />);
    const card = screen.getByTestId('slot-card');
    expect(card).toHaveClass('bg-amber-100/50');
    expect(card).toHaveClass('border-dashed');
    expect(card.querySelectorAll('svg').length).toBe(3);
  });

  it('displays NO state styling and always shows all three icons', () => {
    render(<TimeSlotCard {...defaultProps} value="NO" />);
    const card = screen.getByTestId('slot-card');
    expect(card).toHaveClass('bg-white');
    expect(card.querySelectorAll('svg').length).toBe(3);
  });

  it('displays BLANK state styling and always shows all three icons', () => {
    render(<TimeSlotCard {...defaultProps} value="BLANK" />);
    const card = screen.getByTestId('slot-card');
    expect(card).toHaveClass('bg-neutral-50');
    expect(card.querySelectorAll('svg').length).toBe(3);
  });

  it('does NOT call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} disabled={true} />);
    fireEvent.click(screen.getByTestId('slot-card'));
    fireEvent.click(screen.getByTestId('icon-YES'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('slot-card')).toHaveClass('opacity-70');
    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio).toHaveAttribute('tabindex', '-1');
    });
  });

  it('calls onChange with YES directly and does not bubble when the YES option is clicked', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} value="NO" />);
    fireEvent.click(screen.getByTestId('icon-YES'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('YES');
  });

  it('calls onChange with IF_NEED_BE directly and does not bubble when the IF_NEED_BE option is clicked', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} value="YES" />);
    fireEvent.click(screen.getByTestId('icon-IF_NEED_BE'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('IF_NEED_BE');
  });

  it('calls onChange with NO directly and does not bubble when the NO option is clicked', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} value="IF_NEED_BE" />);
    fireEvent.click(screen.getByTestId('icon-NO'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('NO');
  });

  it('selects the option with Enter and navigates options with arrow keys', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} value="YES" />);
    const yesRadio = screen.getByRole('radio', { name: 'Yes' });
    fireEvent.keyDown(yesRadio, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('IF_NEED_BE');

    onChange.mockClear();
    fireEvent.keyDown(yesRadio, { key: 'ArrowLeft' });
    // Wraps from first option to last.
    expect(onChange).toHaveBeenCalledWith('NO');

    onChange.mockClear();
    fireEvent.keyDown(yesRadio, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('YES');
  });
});
