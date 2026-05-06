import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';
import * as api from '@/lib/pollApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('VotePollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // Wait for the poll to load
    expect(await screen.findByText('Mock Meeting')).toBeInTheDocument();

    const nameInput = screen.getByTestId('participant-name-input');
    fireEvent.change(nameInput, { target: { value: 'Test Voter' } });

    // In the component, checkmarks might be text or icons
    const voteButtons = screen.getAllByRole('button');
    // Find the first slot card button
    const slotCard = voteButtons.find(b => b.getAttribute('data-testid') === 'slot-card');
    if (slotCard) {
      fireEvent.click(slotCard);
    }

    const submitBtn = screen.getByTestId('vote-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Consensus matrix updated/i)).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching poll (Stream E12)', () => {
    vi.mocked(api.fetchPollAction).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows Poll not found message (Stream E13)', async () => {
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ data: { poll: null } } as any);
    renderPage();
    expect(await screen.findByText(/Poll not found/i)).toBeInTheDocument();
  });

  it('shows Poll Finalized message (Stream E14)', async () => {
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ 
      data: { 
        poll: { status: 'FINALIZED', title: 'Final Poll', timeSlots: [] },
        voteCounts: {},
        votes: []
      } 
    } as any);
    renderPage();
    expect(await screen.findByText(/Poll Finalized/i)).toBeInTheDocument();
    expect(screen.getByText(/This poll has been finalized/i)).toBeInTheDocument();
  });

  it('renders all time slots (Stream E16)', async () => {
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ 
      data: { 
        poll: { 
          title: 'Multi Slot', 
          timeSlots: [
            { id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' },
            { id: 't2', startTime: '2026-01-01T12:00:00Z', endTime: '2026-01-01T13:00:00Z' }
          ] 
        },
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 }, t2: { YES: 0, NO: 0, IF_NEED_BE: 0 } },
        votes: []
      } 
    } as any);
    renderPage();
    expect(await screen.findAllByTestId('slot-card')).toHaveLength(2);
  });

  it('disables submit button when name is empty (Stream E17)', async () => {
    renderPage();
    const submitBtn = await screen.findByTestId('vote-submit-btn');
    expect(submitBtn).toBeDisabled();
    
    const nameInput = screen.getByTestId('participant-name-input');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('displays error on submission failure (Stream E19)', async () => {
    renderPage();
    await screen.findByText('Mock Meeting');
    
    vi.mocked(api.submitVoteAction).mockRejectedValueOnce(new Error('Vote Failed'));
    
    const nameInput = screen.getByTestId('participant-name-input');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    
    const submitBtn = screen.getByTestId('vote-submit-btn');
    fireEvent.click(submitBtn);
    
    expect(await screen.findByText('Vote Failed')).toBeInTheDocument();
  });

  it('share button copies URL and shows Copied! (Stream E20, E21)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    
    renderPage();
    await screen.findByText('Mock Meeting');
    
    const shareBtn = screen.getByLabelText(/Share poll/i);
    fireEvent.click(shareBtn);
    
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });
});
