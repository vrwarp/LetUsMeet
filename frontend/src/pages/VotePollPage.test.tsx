import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('VotePollPage', () => {
  let mockSession: any;

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', displayName: 'Test User', email: 'test@example.com', isAnonymous: false },
      loading: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn()
    });

    mockSession = {
      appendEvent: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn(),
      getGenesisEvent: vi.fn().mockResolvedValue({
        signerPublicKey: 'mock-admin-pubkey',
        action: {
          type: 'POLL_CREATED',
          payload: {
            title: 'Mock ZK Meeting',
            location: 'Virtual',
            schedulingMode: 'EXACT',
            organizerName: 'Test User',
            timeSlots: []
          }
        }
      }),
      exportSessionKey: vi.fn().mockReturnValue('YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
      getSignerPublicKey: vi.fn().mockReturnValue('pub123'),
    };

    vi.spyOn(pollService, 'getLedgerSession').mockResolvedValue(mockSession as any);

    vi.mocked(pollService.subscribeToLedger).mockImplementation((_session, cb) => {
      cb({
        pollId: 'mock-poll-id-123',
        metadata: { 
          title: 'Mock ZK Meeting', 
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' }]
        },
        votes: new Map(),
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });
  });

  const renderPage = (pollId = 'mock-poll-id-123') => {
    return render(
      <MemoryRouter initialEntries={[`/poll/${pollId}#key=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=`]}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePollPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('allows selecting votes and submitting', async () => {
    renderPage();
    expect(await screen.findByText('Mock ZK Meeting')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Your Name/i);
    
    await waitFor(() => {
      expect(nameInput).toHaveValue('Test User');
    });

    const slotCard = screen.getByTestId('slot-card');
    fireEvent.click(slotCard);

    const submitBtn = screen.getByRole('button', { name: /Submit Vote/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Vote Recorded!/i)).toBeInTheDocument();
      expect(mockSession.appendEvent).toHaveBeenCalled();
    });
  });

  it('shows loading spinner while fetching poll', () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce(() => () => {});
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows Poll Finalized message', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementation((_session, cb) => {
      cb({ 
        pollId: 'mock-poll-id-123',
        isFinalized: true,
        metadata: { title: 'Final Poll', timeSlots: [], schedulingMode: 'EXACT' },
        votes: new Map()
      } as any, 'Synced');
      return () => {};
    });
    renderPage();
    expect(await screen.findByText(/Poll Finalized/i)).toBeInTheDocument();
  });

  it('renders all time slots', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
      cb({ 
        pollId: 'mock-poll-id-123',
        metadata: { 
          title: 'Multi Slot', 
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [
            { id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' },
            { id: 't2', startTime: '2026-01-01T12:00:00Z', endTime: '2026-01-01T13:00:00Z' }
          ] 
        },
        votes: new Map()
      } as any, 'Synced');
      return () => {};
    });
    renderPage();
    expect(await screen.findAllByTestId('slot-card')).toHaveLength(2);
  });

  it('displays error on submission failure', async () => {
    renderPage();
    await screen.findByText('Mock ZK Meeting');
    
    const nameInput = screen.getByLabelText(/Your Name/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
    });

    mockSession.appendEvent.mockRejectedValueOnce(new Error('Vote Failed'));
    
    const submitBtn = screen.getByRole('button', { name: /Submit Vote/i });
    
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    
    expect(await screen.findByTestId('error-message')).toHaveTextContent('Vote Failed');
  });

  it('hides Retract Vote button when there is nothing to retract', async () => {
    renderPage();
    await screen.findByText('Mock ZK Meeting');
    expect(screen.queryByRole('button', { name: /Retract Vote/i })).not.toBeInTheDocument();
  });

  it('shows Retract Vote button when there is a vote to retract', async () => {
    const votes = new Map();
    votes.set('pub123:r1', {
      responseId: 'r1',
      participantName: 'Test User',
      selections: { t1: 'YES' },
      clientTimestamp: Date.now()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
      cb({
        pollId: 'mock-poll-id-123',
        metadata: {
          title: 'Mock ZK Meeting',
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' }]
        },
        votes,
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });

    renderPage();
    
    await screen.findByText('Mock ZK Meeting');
    expect(await screen.findByRole('button', { name: /Retract Vote/i })).toBeInTheDocument();
  });

  it('renders response switcher even when there is only one submitted response', async () => {
    const votes = new Map();
    votes.set('pub123:r1', {
      responseId: 'r1',
      participantName: 'Olive Orange',
      selections: { t1: 'YES' },
      clientTimestamp: 1778900000000
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
      cb({
        pollId: 'mock-poll-id-123',
        metadata: {
          title: 'Mock ZK Meeting',
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' }]
        },
        votes,
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });

    renderPage();
    
    await screen.findByText('Mock ZK Meeting');
    expect(screen.getByText(/Switch between your responses/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Olive Orange/i })).toBeInTheDocument();
  });

  it('saves and loads drafts from localStorage', async () => {
    localStorage.setItem('draft_mock-poll-id-123', JSON.stringify({
      participantName: 'Draft User',
      participantEmail: 'draft@example.com',
      selections: { t1: 'IF_NEED_BE' }
    }));

    renderPage();
    await screen.findByText('Mock ZK Meeting');

    const nameInput = screen.getByLabelText(/Your Name/i);
    await waitFor(() => {
      expect(nameInput).toHaveValue('Draft User');
    });

    const emailInput = screen.getByLabelText(/Email Address/i);
    expect(emailInput).toHaveValue('draft@example.com');
  });
});
