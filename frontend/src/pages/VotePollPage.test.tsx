import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('VotePollPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', displayName: 'Test User', email: 'test@example.com', isAnonymous: false },
      loading: false,
      signInWithGoogle: vi.fn(),
      signOutUser: vi.fn()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementation((_id, _key, cb) => {
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

    vi.mocked(pollService.appendSignedEvent).mockResolvedValue(undefined);
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
      expect(pollService.appendSignedEvent).toHaveBeenCalled();
    });
  });

  it('shows loading spinner while fetching poll', () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce(() => () => {});
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows Poll Finalized message', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
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
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
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
    
    vi.mocked(pollService.appendSignedEvent).mockRejectedValueOnce(new Error('Vote Failed'));
    
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
    const crypto = await import('@/lib/crypto');
    vi.spyOn(crypto, 'exportPublicKey').mockResolvedValue('pub123');

    const votes = new Map();
    votes.set('pub123:r1', {
      responseId: 'r1',
      participantName: 'Test User',
      selections: { t1: 'YES' },
      clientTimestamp: Date.now()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
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
    const crypto = await import('@/lib/crypto');
    vi.spyOn(crypto, 'exportPublicKey').mockResolvedValue('pub123');

    const votes = new Map();
    votes.set('pub123:r1', {
      responseId: 'r1',
      participantName: 'Olive Orange',
      selections: { t1: 'YES' },
      clientTimestamp: 1778900000000
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
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
});
