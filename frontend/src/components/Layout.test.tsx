import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '@/test/renderWithProviders';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigation: () => ({ state: 'idle' }),
  };
});

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
    
    expect(screen.getByText(/Benson Tsai/i)).toBeInTheDocument();
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
