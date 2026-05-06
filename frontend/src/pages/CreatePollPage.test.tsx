import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreatePollPage from '@/pages/CreatePollPage';
import { useAuth } from '@/hooks/useAuth';
import * as pollApi from '@/lib/pollApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('CreatePollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'user123', email: 'test@example.com' },
      loading: false,
    });
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

  it('shows loading spinner while auth is loading (Stream E4)', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true });
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    expect(screen.getByTestId('loader')).toBeInTheDocument();
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
    vi.mocked(pollApi.createPollAction).mockRejectedValueOnce(new Error('API Error'));
    
    render(
      <MemoryRouter>
        <CreatePollPage />
      </MemoryRouter>
    );
    
    const titleInput = await screen.findByTestId('poll-title-input');
    await userEvent.type(titleInput, 'Title');
    
    const submitBtn = screen.getByTestId('create-submit-btn');
    fireEvent.click(submitBtn);
    
    expect(await screen.findByText('API Error')).toBeInTheDocument();
  });
});
