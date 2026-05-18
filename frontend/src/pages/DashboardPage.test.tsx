import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as pollService from '@/lib/pollService';
import * as deviceService from '@/lib/deviceService';
import * as recoveryService from '@/lib/recoveryService';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/pollService');
vi.mock('@/lib/deviceService');
vi.mock('@/lib/recoveryService');

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', isAnonymous: false },
      loading: false,
      pendingRequests: [],
    });

    vi.mocked(pollService.subscribeToUserKeystore).mockImplementation((_uid, cb) => {
      cb([{
        pollId: 'p1',
        amkId: 'amk_v1',
        wrappedPayload: 'ciphertext',
        iv: 'iv',
        updatedAt: Date.now()
      }]);
      return () => { };
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

    vi.mocked(deviceService.getRecoveryStatus).mockResolvedValue({
      isSealed: true,
      methods: ['Passkey'],
      isCurrentPrfSealed: true
    });

    vi.mocked(deviceService.getDeviceId).mockReturnValue('test-device-id');
    vi.mocked(recoveryService.setupPhraseRecovery).mockResolvedValue('mock mnemonic phrase');
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
      return () => { };
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No polls/i)).toBeInTheDocument();
  });
});
