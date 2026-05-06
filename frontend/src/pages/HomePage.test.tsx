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
    
    expect(screen.getByText(/Let everyone meet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create your first poll/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create your first poll/i })).toHaveAttribute('href', '/create');
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
