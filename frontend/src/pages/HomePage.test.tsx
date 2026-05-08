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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Let everyone meet/i);
    expect(screen.getByRole('link', { name: /Start a Poll/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start a Poll/i })).toHaveAttribute('href', '/create');
  });

  it('renders features section', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    
    expect(screen.getByTestId('feature-frictionless')).toBeInTheDocument();
    expect(screen.getByTestId('feature-trinary')).toBeInTheDocument();
    expect(screen.getByTestId('feature-sync')).toBeInTheDocument();
  });
});
