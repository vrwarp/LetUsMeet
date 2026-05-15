import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResultsPage from './ResultsPage';
import * as pollService from '@/lib/pollService';


describe('ResultsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderPage = (pollId = 'mock-poll-id-123') => {
    return render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results#key=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders availability grid and totals', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementation((_id, _key, cb) => {
      cb({
        pollId: 'p1',
        metadata: { 
          title: 'Mock ZK Results', 
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' }]
        },
        votes: new Map(),
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });

    renderPage();
    expect(await screen.findByText('Mock ZK Results')).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce(() => () => {});
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders availability grid and totals with custom data', async () => {
    const votes = new Map();
    votes.set('pub1', { participantName: 'Alice', selections: { t1: 'YES' } });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
      cb({
        pollId: 'p1',
        metadata: { 
          title: 'Meeting Results', 
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }]
        },
        votes,
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });
    
    renderPage();
    
    expect(await screen.findByText('Meeting Results')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/1 participants/i)).toBeInTheDocument();
    
    // Check vote counts
    const row = screen.getByText('TOTAL').closest('tr');
    expect(row).toHaveTextContent('1');
  });

  it('shows No responses yet message', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
      cb({ 
        pollId: 'p1',
        metadata: { title: 'Empty Results', timeSlots: [{ id: 't1' }], schedulingMode: 'EXACT' },
        votes: new Map(),
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });
    
    renderPage();
    expect(await screen.findByText(/No responses yet/i)).toBeInTheDocument();
  });

  it('shows Leading badge on best slot', async () => {
    const votes = new Map();
    votes.set('pub1', { participantName: 'Alice', selections: { t1: 'YES' } });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_id, _key, cb) => {
      cb({ 
        pollId: 'p1',
        metadata: { 
          title: 'Leading Poll', 
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }]
        },
        votes,
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });
    
    renderPage();
    expect(await screen.findByText(/Leading/i)).toBeInTheDocument();
  });
});
