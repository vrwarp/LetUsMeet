import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as pollService from '@/lib/pollService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', isAnonymous: false },
      loading: false,
    });

    vi.mocked(pollService.subscribeToUserKeystore).mockImplementation((_uid, cb) => {
      cb([{ 
        pollId: 'p1', 
        wrappedPayload: 'ciphertext', 
        iv: 'iv', 
        updatedAt: Date.now() 
      }]);
      return () => {};
    });

    vi.mocked(pollService.loadFromKeystore).mockResolvedValue({ 
      symmetricPollKey: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
      ecdsaPrivateKey: 'priv',
      ecdsaPublicKey: 'pub'
    });
    
    vi.mocked(pollService.getGenesisEvent).mockResolvedValue({
      title: 'Mock ZK Meeting',
      location: 'Virtual',
      schedulingMode: 'EXACT',
      organizerName: 'Test User',
      timeSlots: []
    });
  });

  it('renders decrypted polls from keystore', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Mock ZK Meeting')).toBeInTheDocument();
  });

  it('shows empty state when no polls found', async () => {
    vi.mocked(pollService.subscribeToUserKeystore).mockImplementationOnce((_uid, cb) => {
      cb([]);
      return () => {};
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No polls in your keystore/i)).toBeInTheDocument();
  });
});
