import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VotePollPage from './VotePollPage';

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
});
