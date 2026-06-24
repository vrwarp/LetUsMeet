import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders welcome message and CTA', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Find a time that works for everyone/i);
    expect(screen.getByRole('link', { name: /Create a poll/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create a poll/i })).toHaveAttribute('href', '/create');
  });
});
