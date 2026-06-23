import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeviceEnrollmentGate from './DeviceEnrollmentGate';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('DeviceEnrollmentGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children if not logged in', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      isDeviceRegistered: false,
      enrollDevice: vi.fn(),
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.queryByText(/Secure your account/i)).not.toBeInTheDocument();
  });

  it('renders children if user is anonymous', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { isAnonymous: true },
      loading: false,
      isDeviceRegistered: false,
      enrollDevice: vi.fn(),
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.queryByText(/Secure your account/i)).not.toBeInTheDocument();
  });

  it('renders children if device is registered', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { isAnonymous: false, uid: '123' },
      loading: false,
      isDeviceRegistered: true,
      enrollDevice: vi.fn(),
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.queryByText(/Secure your account/i)).not.toBeInTheDocument();
  });

  it('renders interstitial if logged in and not registered', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { isAnonymous: false, uid: '123' },
      loading: false,
      isDeviceRegistered: false,
      enrollDevice: vi.fn(),
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.getByText('Secure your account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up my passkey' })).toBeInTheDocument();
  });

  it('displays error on enrollment NotAllowedError', async () => {
    const user = userEvent.setup();
    const enrollMock = vi.fn().mockRejectedValue(new DOMException('Canceled', 'NotAllowedError'));

    vi.mocked(useAuth).mockReturnValue({
      user: { isAnonymous: false, uid: '123' },
      loading: false,
      isDeviceRegistered: false,
      enrollDevice: enrollMock,
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    await user.click(screen.getByRole('button', { name: 'Set up my passkey' }));

    expect(enrollMock).toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent("Passkey setup was canceled. You'll need one to keep your polls encrypted — tap to try again.");
  });

  it('renders children if there is a key mismatch error', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { isAnonymous: false, uid: '123' },
      loading: false,
      isDeviceRegistered: false,
      keyMismatchError: 'UNRECOGNIZED_DEVICE: Device not authorized.',
      enrollDevice: vi.fn(),
    } as any);

    render(
      <DeviceEnrollmentGate>
        <div data-testid="child-element">Child Content</div>
      </DeviceEnrollmentGate>
    );

    expect(screen.getByTestId('child-element')).toBeInTheDocument();
    expect(screen.queryByText(/Secure your account/i)).not.toBeInTheDocument();
  });
});
