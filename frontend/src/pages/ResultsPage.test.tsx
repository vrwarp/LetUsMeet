import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
