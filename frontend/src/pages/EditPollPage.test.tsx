import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EditPollPage from './EditPollPage';
import * as pollService from '@/lib/pollService';
import type { PollState } from '@/types';
import type { LedgerSession } from 'charproof';

describe('EditPollPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // extractKeyFromFragment is mocked globally to return a valid key; restore the
    // default behaviour after resetAllMocks so the editor's load path runs.
    vi.mocked(pollService.extractKeyFromFragment).mockReturnValue(
      'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='
    );
    vi.mocked(pollService.friendlyStatus).mockImplementation((s: string) => s);
  });

  const renderPage = (pollId = 'mock-poll-id-123') => {
    return renderWithProviders(
      <MemoryRouter initialEntries={[`/poll/${pollId}/edit#key=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=`]}>
        <Routes>
          <Route path="/poll/:pollId/edit" element={<EditPollPage />} />
          <Route path="/poll/:pollId" element={<div>Poll Page Mock</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  const adminState = {
    pollId: 'mock-poll-id-123',
    adminPublicKey: 'mock-admin-pubkey',
    metadata: {
      title: 'Team Sync Poll',
      description: 'Pick a time',
      location: 'Virtual',
      organizerName: 'Organizer',
      schedulingMode: 'EXACT',
      timeSlots: [
        { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
        { id: 't2', startTime: '2026-10-11T14:00:00Z', endTime: '2026-10-11T15:00:00Z' },
      ],
    },
    votes: new Map(),
    isFinalized: false,
  } as unknown as PollState;

  it('renders the editor pre-populated from the synced poll state when the signer is the admin, creating exactly one subscription', async () => {
    const subscribeSpy = vi.mocked(pollService.subscribeToLedger).mockImplementation((_session, cb) => {
      cb(adminState, 'Synced');
      return () => {};
    });

    const mockSession = {
      getSignerPublicKey: () => 'mock-admin-pubkey',
      appendEvent: vi.fn().mockResolvedValue(undefined),
    };
    const sessionSpy = vi.mocked(pollService.getLedgerSession).mockResolvedValue(
      mockSession as unknown as LedgerSession
    );

    renderPage();

    // Editor renders (heading) and the title field is seeded from the synced state.
    expect(await screen.findByText('Edit Your Poll')).toBeInTheDocument();
    const titleInput = await screen.findByLabelText(/Meeting Title/i);
    await waitFor(() => {
      expect(titleInput).toHaveValue('Team Sync Poll');
    });

    // Both synced time slots are seeded into the form.
    expect(screen.getByTestId('slot-date-0')).toBeInTheDocument();
    expect(screen.getByTestId('slot-date-1')).toBeInTheDocument();

    // The load/seed path must create exactly one subscription (no churn from
    // adminPublicKey flipping undefined -> value on first sync).
    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the Admin Access Required gate (after loading) when the signer is NOT the admin', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementation((_session, cb) => {
      cb(adminState, 'Synced');
      return () => {};
    });

    // Signer public key does not match the poll's admin key.
    const mockSession = {
      getSignerPublicKey: () => 'some-other-pubkey',
      appendEvent: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(pollService.getLedgerSession).mockResolvedValue(
      mockSession as unknown as LedgerSession
    );

    renderPage();

    expect(await screen.findByText('Admin Access Required')).toBeInTheDocument();
    // The editor form must NOT render for a non-admin.
    expect(screen.queryByText('Edit Your Poll')).not.toBeInTheDocument();
  });
});
