import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/pollService');

const mockUser = {
  uid: 'user123',
  displayName: 'Test User',
  email: 'test@example.com',
  isAnonymous: false
};

describe('VotePollPage - Editing and Multiple Votes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser, loading: false });
  });

  const renderPage = (pollId = 'poll123') => {
    return render(
      <MemoryRouter initialEntries={[`/poll/${pollId}`]}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePollPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  const mockPoll = {
    id: 'poll123',
    pollId: 'poll123',
    title: 'Test Poll',
    timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }],
    status: 'OPEN'
  };

  it('detects existing vote and enters edit mode', async () => {
    const existingVote = {
      voteId: 'vote123',
      participantUid: 'user123',
      participantName: 'Alice',
      selections: { t1: 'YES' },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce((_id, cb) => {
      cb({
        poll: mockPoll as any,
        votes: [existingVote] as any,
        voteCounts: { t1: { YES: 1, NO: 0, IF_NEED_BE: 0 } }
      });
      return () => {};
    });

    renderPage();

    expect(await screen.findByText(/Editing your previous response/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('participant-name-input')).toHaveValue('Alice');
    expect(screen.getByText(/Update Your Response/i)).toBeInTheDocument();
  });

  it('allows switching to new response mode', async () => {
    const existingVote = {
      voteId: 'vote123',
      participantUid: 'user123',
      participantName: 'Alice',
      selections: { t1: 'YES' },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce((_id, cb) => {
      cb({
        poll: mockPoll as any,
        votes: [existingVote] as any,
        voteCounts: { t1: { YES: 1, NO: 0, IF_NEED_BE: 0 } }
      });
      return () => {};
    });

    renderPage();

    expect(await screen.findByText(/Editing your previous response/i, {}, { timeout: 5000 })).toBeInTheDocument();
    
    const newResponseBtn = screen.getByText(/Submit New Response/i);
    fireEvent.click(newResponseBtn);

    expect(screen.getByText(/Submitting a new response/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Your Vote/i)).toBeInTheDocument();
  });

  it('handles multiple votes and allows switching between them', async () => {
    const vote1 = {
      voteId: 'vote1',
      participantUid: 'user123',
      participantName: 'Alice 1',
      selections: { t1: 'YES' },
      updatedAt: new Date(Date.now() - 10000).toISOString(),
      createdAt: new Date(Date.now() - 10000).toISOString()
    };
    const vote2 = {
      voteId: 'vote2',
      participantUid: 'user123',
      participantName: 'Alice 2',
      selections: { t1: 'NO' },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    vi.mocked(pollService.subscribeToPoll).mockImplementationOnce((_id, cb) => {
      cb({
        poll: mockPoll as any,
        votes: [vote1, vote2] as any,
        voteCounts: { t1: { YES: 1, NO: 1, IF_NEED_BE: 0 } }
      });
      return () => {};
    });

    renderPage();

    expect(await screen.findByText(/You've submitted 2 responses/i, {}, { timeout: 5000 })).toBeInTheDocument();
    
    // Should default to vote2 (latest)
    expect(screen.getByTestId('participant-name-input')).toHaveValue('Alice 2');

    const response1Btn = screen.getByText(/Alice 1 \(/i);
    fireEvent.click(response1Btn);

    expect(screen.getByTestId('participant-name-input')).toHaveValue('Alice 1');
  });
});
