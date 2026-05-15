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
    
    // Logo image is now alt="" for a11y redundancy reasons, find by role or link
    expect(screen.getByRole('link', { name: /LetUsMeet/i })).toBeInTheDocument();
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

  it('renders dashboard, sign out and profile image when authenticated', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const event = userEvent.setup();
    
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    
    // Initial of "Test User" should be visible
    const profileBtn = screen.getByText('T');
    expect(profileBtn).toBeInTheDocument();
    
    // Dashboard and Sign Out should NOT be visible initially
    expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
    
    // Click the profile button
    await event.click(profileBtn);
    
    // Now they should be visible
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign Out/i)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
  });
});
