import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/pollService');

describe('VotePollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', displayName: 'Test User', email: 'test@example.com', isAnonymous: false },
      loading: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn()
    });

    vi.mocked(pollService.subscribeToPoll).mockImplementation((_id, cb) => {
      cb({
        poll: { 
          id: 'mock-poll-id-123',
          pollId: 'mock-poll-id-123',
          title: 'Mock Meeting', 
          timeSlots: [{ id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' }],
          status: 'OPEN'
        } as any,
        votes: [{ 
          voteId: 'v1',
          participantUid: 'v1', 
          participantName: 'Alice', 
          selections: { t1: 'YES' }, 
          updatedAt: '2026-05-09T00:00:00Z',
          createdAt: '2026-05-09T00:00:00Z'
        }] as any,
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } }
      });
      return () => {};
    });

    vi.mocked(pollService.submitVote).mockResolvedValue(undefined);
  });

  const renderPage = (pollId = 'mock-poll-id-123') => {
    return render(
      <MemoryRouter initialEntries={[`/poll/${pollId}`]}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePollPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('allows selecting votes and submitting', async () => {
    renderPage();
    expect(await screen.findByText('Mock Meeting')).toBeInTheDocument();

    const nameInput = screen.getByTestId('participant-name-input');
    const emailInput = screen.getByTestId('participant-email-input');
    
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
      expect(emailInput).toHaveValue('test@example.com');
    });

    const voteButtons = screen.getAllByRole('button');
    const slotCard = voteButtons.find(b => b.getAttribute('data-testid') === 'slot-card');
    if (slotCard) {
      fireEvent.click(slotCard);
    }

    const submitBtn = screen.getByTestId('vote-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vote Cast!/i)).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching poll', () => {
    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce(() => () => {});
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows Poll Finalized message', async () => {
    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce((_id, cb) => {
      cb({ 
        poll: { status: 'FINALIZED', title: 'Final Poll', timeSlots: [] } as any,
        voteCounts: {},
        votes: []
      });
      return () => {};
    });
    renderPage();
    expect(await screen.findByText(/Poll Finalized/i)).toBeInTheDocument();
    expect(screen.getByText(/This poll has been finalized/i)).toBeInTheDocument();
  });

  it('renders all time slots', async () => {
    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce((_id, cb) => {
      cb({ 
        poll: { 
          title: 'Multi Slot', 
          timeSlots: [
            { id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' },
            { id: 't2', startTime: '2026-01-01T12:00:00Z', endTime: '2026-01-01T13:00:00Z' }
          ] 
        } as any,
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 }, t2: { YES: 0, NO: 0, IF_NEED_BE: 0 } },
        votes: []
      });
      return () => {};
    });
    renderPage();
    expect(await screen.findAllByTestId('slot-card')).toHaveLength(2);
  });

  it('disables submit button when name is empty', async () => {
    renderPage();
    const submitBtn = await screen.findByTestId('vote-submit-btn');
    expect(submitBtn).not.toBeDisabled();
    
    const nameInput = screen.getByTestId('participant-name-input');
    fireEvent.change(nameInput, { target: { value: '' } });
    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });
  });

  it('displays error on submission failure', async () => {
    renderPage();
    await screen.findByText('Mock Meeting');
    
    vi.mocked(pollService.submitVote).mockRejectedValueOnce(new Error('Vote Failed'));
    
    const nameInput = screen.getByTestId('participant-name-input');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    
    const submitBtn = screen.getByTestId('vote-submit-btn');
    fireEvent.click(submitBtn);
    
    expect(await screen.findByText('Vote Failed')).toBeInTheDocument();
  });
});
