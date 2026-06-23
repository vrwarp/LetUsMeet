import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders as render } from '@/test/renderWithProviders';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as pollService from '@/lib/pollService';
import * as deviceService from 'charproof';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/lib/pollService');
vi.mock('charproof', () => ({
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

  it('categorizes polls and allows switching between Organized and Joined tabs', async () => {
    vi.mocked(pollService.subscribeToUserKeystore).mockImplementation((cb: any) => {
      cb([
        {
          ledgerId: 'p1',
          amkId: 'amk_v1',
          encryptedData: 'ciphertext',
          iv: 'iv',
          updatedAt: Date.now()
        },
        {
          ledgerId: 'p2',
          amkId: 'amk_v1',
          encryptedData: 'ciphertext',
          iv: 'iv',
          updatedAt: Date.now()
        }
      ] as any);
      return () => { };
    });

    vi.mocked(pollService.getLedgerSession).mockImplementation(async (ledgerId: string) => {
      const isP1 = ledgerId === 'p1';
      return {
        appendEvent: vi.fn(),
        subscribe: vi.fn(),
        getGenesisEvent: vi.fn().mockResolvedValue({
          signerPublicKey: isP1 ? 'pub' : 'other-pub',
          action: {
            type: 'POLL_CREATED',
            payload: {
              title: isP1 ? 'Mock Organized Meeting' : 'Mock Joined Meeting',
              location: 'Virtual',
              schedulingMode: 'EXACT',
              organizerName: isP1 ? 'Organizer User' : 'Other User',
              timeSlots: []
            }
          }
        }),
        exportSessionKey: vi.fn().mockReturnValue('YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
        getSignerPublicKey: vi.fn().mockReturnValue('pub'),
      } as any;
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Should display tab buttons
    const organizedTab = await screen.findByTestId('tab-organizer');
    const participantTab = await screen.findByTestId('tab-participant');
    expect(organizedTab).toBeInTheDocument();
    expect(participantTab).toBeInTheDocument();

    // Active tab (organized) shows p1 and hides p2
    expect(await screen.findByText('Mock Organized Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Mock Joined Meeting')).not.toBeInTheDocument();

    // Click on Participant tab
    fireEvent.click(participantTab);

    // Participant tab shows p2 and hides p1
    expect(await screen.findByText('Mock Joined Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Mock Organized Meeting')).not.toBeInTheDocument();
  });
});
