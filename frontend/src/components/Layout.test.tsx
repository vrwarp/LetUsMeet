import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';

describe('Layout', () => {
  it('renders header with branding and navigation', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    
    expect(screen.getByAltText('LetUsMeet')).toBeInTheDocument();
    expect(screen.getByText('Create Poll')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /LetUsMeet/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Create Poll/i })).toHaveAttribute('href', '/create');
  });

  it('renders footer', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    
    expect(screen.getByText(/Simple group scheduling/i)).toBeInTheDocument();
  });

  it('renders child routes via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>Test Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
