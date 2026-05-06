import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreatePollPage from '@/pages/CreatePollPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('CreatePollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form', async () => {
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    
    expect(await screen.findByText(/Meeting Title/i)).toBeInTheDocument();
  });

  it('submits the form successfully', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    
    const titleInput = await screen.findByTestId('poll-title-input');
    await user.type(titleInput, 'Lunch');
    
    const locationInput = screen.getByTestId('poll-location-input');
    await user.type(locationInput, 'Cafe');
    
    const startTimeInput = screen.getByTestId('slot-start-0');
    const endTimeInput = screen.getByTestId('slot-end-0');
    
    fireEvent.change(startTimeInput, { target: { value: '12:00' } });
    fireEvent.change(endTimeInput, { target: { value: '13:00' } });
    
    const submitBtn = screen.getByTestId('create-submit-btn');
    
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    }, { timeout: 2000 });
    
    await user.click(submitBtn);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
