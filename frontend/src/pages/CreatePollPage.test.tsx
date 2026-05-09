import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreatePollPage from '@/pages/CreatePollPage';
import * as pollService from '@/lib/pollService';

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
    
    const nameInput = screen.getByTestId('organizer-name-input');
    const emailInput = screen.getByTestId('organizer-email-input');
    
    // Verify prefilled values from mock useAuth
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
      expect(emailInput).toHaveValue('test@example.com');
    });
    
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


  it('disables submit button when title is empty (Stream E6)', async () => {
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    const submitBtn = screen.getByTestId('create-submit-btn');
    expect(submitBtn).toBeDisabled();
    
    const titleInput = await screen.findByTestId('poll-title-input');
    await userEvent.type(titleInput, 'Title');
    // name and email are prefilled, so button should be enabled once title is typed
    expect(submitBtn).not.toBeDisabled();
  });

  it('adds and removes time slots (Stream E7, E8)', async () => {
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    
    const addBtn = screen.getByTestId('add-slot-btn');
    fireEvent.click(addBtn);
    expect(screen.getAllByTestId(/slot-start-/)).toHaveLength(2);
    
    const removeBtn = screen.getAllByRole('button', { name: /Remove time slot/i })[1];
    fireEvent.click(removeBtn);
    expect(screen.getAllByTestId(/slot-start-/)).toHaveLength(1);
  });

  it('displays error message on API failure (Stream E10)', async () => {
    vi.mocked(pollService.createPoll).mockRejectedValueOnce(new Error('API Error'));
    
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    
    const titleInput = await screen.findByTestId('poll-title-input');
    await userEvent.type(titleInput, 'Title');
    // name and email are prefilled
    
    const submitBtn = screen.getByTestId('create-submit-btn');
    fireEvent.click(submitBtn);
    
    expect(await screen.findByText('API Error')).toBeInTheDocument();
  });
});
