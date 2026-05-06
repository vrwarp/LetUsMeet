import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResultsPage from './ResultsPage';
import * as api from '@/lib/pollApi';

console.log('API MODULE TYPE:', typeof api);
console.log('fetchPollAction TYPE:', typeof api.fetchPollAction);

describe('ResultsPage', () => {
  const renderPage = (pollId = 'mock-poll-id-123') => {
    return render(
      <MemoryRouter initialEntries={[`/poll/${pollId}/results`]}>
        <Routes>
          <Route path="/poll/:pollId/results" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders consensus grid and totals', async () => {
    renderPage();
    expect(await screen.findByText('Mock Meeting')).toBeInTheDocument();
  });

  it('shows loading spinner (Stream E22)', () => {
    vi.mocked(api.fetchPollAction).mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows error state with Return Home link (Stream E23)', async () => {
    vi.mocked(api.fetchPollAction).mockRejectedValueOnce(new Error('Fetch Failed'));
    renderPage();
    expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText('Fetch Failed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Home/i })).toHaveAttribute('href', '/');
  });

  it('renders consensus grid and totals (Stream E24, E25, E28, E30)', async () => {
    const pollData = {
      poll: { 
        title: 'Meeting Results', 
        timeSlots: [
          { id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }
        ] 
      },
      voteCounts: { t1: { YES: 1, NO: 0, IF_NEED_BE: 0 } },
      votes: [
        { participantUid: 'v1', participantName: 'Alice', selections: { t1: 'YES' } }
      ]
    };
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ data: pollData } as any);
    
    renderPage();
    
    expect(await screen.findByText('Meeting Results')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/1 participants/i)).toBeInTheDocument();
    
    // Check vote counts
    const row = screen.getByText('Total Yes').closest('tr');
    expect(row).toHaveTextContent('1');
  });

  it('shows No votes submitted yet message (Stream E26)', async () => {
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ 
      data: { 
        poll: { title: 'Empty Results', timeSlots: [{ id: 't1' }] },
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } },
        votes: []
      } 
    } as any);
    
    renderPage();
    expect(await screen.findByText(/No votes have been cast yet/i)).toBeInTheDocument();
  });

  it('shows Leading badge on best slot (Stream E27)', async () => {
    vi.mocked(api.fetchPollAction).mockResolvedValueOnce({ 
      data: { 
        poll: { 
          title: 'Leading Poll', 
          timeSlots: [
            { id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }
          ] 
        },
        voteCounts: { t1: { YES: 1, NO: 0, IF_NEED_BE: 0 } },
        votes: [{ participantUid: 'v1', participantName: 'Alice', selections: { t1: 'YES' } }]
      } 
    } as any);
    
    renderPage();
    expect(await screen.findByText(/Leading/i)).toBeInTheDocument();
  });

  it('Back to Poll link navigates back (Stream E29)', async () => {
    renderPage();
    await screen.findByText('Mock Meeting');
    expect(screen.getByRole('link', { name: /Back to Poll/i })).toBeInTheDocument();
  });
});
