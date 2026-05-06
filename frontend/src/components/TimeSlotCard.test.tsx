import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeSlotCard from './TimeSlotCard';

describe('TimeSlotCard', () => {
  const defaultProps = {
    startTime: '2026-10-10T10:00:00Z',
    endTime: '2026-10-10T11:00:00Z',
    value: 'NO' as const,
    onChange: vi.fn(),
  };

  it('renders date and time range correctly', () => {
    render(<TimeSlotCard {...defaultProps} />);
    const start = new Date(defaultProps.startTime);
    const end = new Date(defaultProps.endTime);
    const expectedDate = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const expectedStart = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const expectedEnd = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    
    expect(screen.getByText(new RegExp(expectedDate.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(expectedStart.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(expectedEnd.replace(/\s/g, '.'), 'i'))).toBeInTheDocument();
  });

  it('displays NO state styling by default', () => {
    render(<TimeSlotCard {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('border-neutral-200');
  });

  it('calls onChange with YES when clicked from NO state', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('YES');
  });

  it('displays YES state styling and icon', () => {
    render(<TimeSlotCard {...defaultProps} value="YES" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-emerald-500');
    // Lucide check icon has stroke-width 3 and size 20 in the component
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays IF_NEED_BE state styling and icon', () => {
    render(<TimeSlotCard {...defaultProps} value="IF_NEED_BE" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-amber-400');
    expect(button).toHaveClass('border-dashed');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('displays NO state styling and icon', () => {
    render(<TimeSlotCard {...defaultProps} value="NO" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-white');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does NOT call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<TimeSlotCard {...defaultProps} onChange={onChange} disabled={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveClass('opacity-70');
  });
});
