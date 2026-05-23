import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as pollService from '@/lib/pollService';
import * as deviceService from '@letusmeet/zero-knowledge';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/pollService');
vi.mock('@letusmeet/zero-knowledge', () => ({
  initializeZK: vi.fn(),
  getRecoveryStatus: vi.fn(),
  getDeviceId: vi.fn(),
  approveDeviceAuthorization: vi.fn(),
  revokeDevice: vi.fn(),
  getActiveAmk: vi.fn(),
  enablePrfRecovery: vi.fn(),
  decryptPayload: vi.fn(),
  generateVerificationCode: vi.fn(),
  getLedgerSession: vi.fn(),
  setupPhraseRecovery: vi.fn(),
  subscribeAuthorizedDevices: vi.fn().mockImplementation((cb) => {
    cb([]);
    return () => { };
  }),
  rejectDeviceRequest: vi.fn().mockResolvedValue(undefined),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuth as any).mockReturnValue({
      user: { uid: 'user123', isAnonymous: false },
      loading: false,
      pendingRequests: [],
    });

    vi.mocked(deviceService.subscribeAuthorizedDevices).mockImplementation((cb: any) => {
      cb([]);
      return () => { };
    });

    vi.mocked(pollService.subscribeToUserKeystore).mockImplementation((cb: any) => {
      cb([{
        ledgerId: 'p1',
        amkId: 'amk_v1',
        encryptedData: 'ciphertext',
        iv: 'iv',
        updatedAt: Date.now()
      } as any]);
      return () => { };
    });

    vi.mocked(pollService.getLedgerSession).mockResolvedValue({
      appendEvent: vi.fn(),
      subscribe: vi.fn(),
      getGenesisEvent: vi.fn().mockResolvedValue({
        signerPublicKey: 'pub',
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
      getSignerPublicKey: vi.fn().mockReturnValue('pub'),
    } as any);

    vi.mocked(deviceService.getRecoveryStatus).mockResolvedValue({
      isSealed: true,
      methods: ['Passkey'],
      isCurrentPrfSealed: true
    });

    vi.mocked(deviceService.getDeviceId).mockReturnValue('test-device-id');
    vi.mocked(deviceService.setupPhraseRecovery).mockResolvedValue('mock mnemonic phrase');
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
    vi.mocked(pollService.subscribeToUserKeystore).mockImplementationOnce((cb: any) => {
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
