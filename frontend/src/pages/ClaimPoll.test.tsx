import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResultsPage from './ResultsPage';
import VotePollPage from './VotePollPage';
import EditPollPage from './EditPollPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('Claim Poll Feature', () => {
  const pollId = 'poll-to-claim';
  const adminToken = 'valid-token';

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    
    // Default mock user
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'my-uid', isAnonymous: false, email: 'me@example.com', displayName: 'Me' } as any,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
    });
  });

  const mockPollWithDifferentOwner = () => {
    vi.mocked(pollService.subscribeToPoll).mockImplementation((_id, cb) => {
      cb({
        poll: {
          id: pollId,
          pollId: pollId,
          title: 'Unclaimed Poll',
          organizerUid: 'someone-else',
          adminToken: adminToken,
          status: 'OPEN',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }],
        } as any,
        votes: [],
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } },
      });
      return () => {};
    });
  };

  it('offers to claim poll on ResultsPage when adminToken is present in localStorage', async () => {
    window.localStorage.setItem(`adminToken_${pollId}`, adminToken);
    mockPollWithDifferentOwner();

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Claim this Poll/i)).toBeInTheDocument();
    expect(screen.getByText(/Add to My Dashboard/i)).toBeInTheDocument();
  });

  it('calls claimPoll when "Add to My Dashboard" is clicked', async () => {
    window.localStorage.setItem(`adminToken_${pollId}`, adminToken);
    mockPollWithDifferentOwner();
    const claimSpy = vi.mocked(pollService.claimPoll);

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const claimButton = await screen.findByText(/Add to My Dashboard/i);
    fireEvent.click(claimButton);

    expect(claimSpy).toHaveBeenCalledWith(pollId, adminToken, 'my-uid');
  });

  it('offers to claim poll on VotePollPage when adminToken is present in URL', async () => {
    mockPollWithDifferentOwner();

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}?adminToken=${adminToken}`]}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePollPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Claim this Poll/i)).toBeInTheDocument();
  });

  it('offers to claim poll on EditPollPage when adminToken is present in URL', async () => {
    mockPollWithDifferentOwner();

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/edit?adminToken=${adminToken}`]}>
        <Routes>
          <Route path="/poll/:pollId/edit" element={<EditPollPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Claim this Poll/i)).toBeInTheDocument();
  });

  it('does NOT offer to claim if already owned by the user', async () => {
    window.localStorage.setItem(`adminToken_${pollId}`, adminToken);
    
    vi.mocked(pollService.subscribeToPoll).mockImplementation((_id, cb) => {
      cb({
        poll: {
          id: pollId,
          pollId: pollId,
          title: 'My Poll',
          organizerUid: 'my-uid',
          adminToken: adminToken,
          status: 'OPEN',
          schedulingMode: 'EXACT',
          timeSlots: [],
        } as any,
        votes: [],
        voteCounts: {},
      });
      return () => {};
    });

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for content to load
    expect(await screen.findByText('My Poll')).toBeInTheDocument();
    expect(screen.queryByText(/Claim this Poll/i)).not.toBeInTheDocument();
  });

  it('does NOT offer to claim if user is not signed in', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn(),
    });
    window.localStorage.setItem(`adminToken_${pollId}`, adminToken);
    mockPollWithDifferentOwner();

    render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Unclaimed Poll')).toBeInTheDocument();
    expect(screen.queryByText(/Claim this Poll/i)).not.toBeInTheDocument();
  });
});
