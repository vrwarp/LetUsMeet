import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    vi.mocked(pollService.subscribeToLedger).mockImplementation((_session, cb) => {
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
    votes.set('pub1', { 
      responseId: 'r1',
      participantName: 'Alice', 
      selections: { t1: 'YES' },
      clientTimestamp: Date.now()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
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
    expect(screen.getByText(/1 response/i)).toBeInTheDocument();
    
    // Check vote counts
    const row = screen.getByText('TOTAL').closest('tr');
    expect(row).toHaveTextContent('1');
  });

  it('renders availability grid showing ⚠ for IF_NEED_BE selections', async () => {
    const votes = new Map();
    votes.set('pub1', { 
      responseId: 'r1',
      participantName: 'Alice', 
      selections: { t1: 'IF_NEED_BE' },
      clientTimestamp: Date.now()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
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
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('shows No responses yet message', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
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
    votes.set('pub1', { 
      responseId: 'r1',
      participantName: 'Alice', 
      selections: { t1: 'YES' },
      clientTimestamp: Date.now()
    });

    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
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

  it('safely constructs mailto link when emailing participants', async () => {
    // Mock user so we are admin
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
      cb({
        pollId: 'p1',
        metadata: {
          title: 'Email Poll',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }],
          organizerUid: 'mock-user-uid'
        },
        adminPublicKey: 'mock-pub-key',
        votes: new Map([['pub1', { participantName: 'Alice', email: 'alice@example.com', selections: { t1: 'YES' }, clientTimestamp: Date.now(), responseId: 'r1' }]]),
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });

    const mockSession = {
      getSignerPublicKey: () => 'mock-pub-key'
    };
    (pollService as any).getLedgerSession = vi.fn().mockResolvedValue(mockSession);

    // Ensure we render the page FIRST so react can create its DOM elements natively
    renderPage();

    // Wait for the button to be rendered before mocking document.createElement
    const emailButton = await screen.findByTitle('Email all participants');
    expect(emailButton).toBeInTheDocument();

    // Mock link element creation and click AFTER render
    const originalCreateElement = document.createElement;
    const mockClick = vi.fn();
    const mockLink = {
      href: '',
      get protocol() {
        try {
          return new URL(this.href).protocol;
        } catch {
          return '';
        }
      },
      target: '',
      rel: '',
      click: mockClick
    };

    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation(function (this: Document, tagName: string, options?: ElementCreationOptions) {
      if (tagName === 'a') return mockLink as unknown as HTMLElement;
      return originalCreateElement.call(document, tagName, options);
    });

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

    emailButton.click();

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.href).toMatch(/^mailto:/);
    expect(mockLink.target).toBe('_blank');
    expect(mockLink.rel).toBe('noopener noreferrer');
    expect(mockClick).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('opens a dialog/modal when clicking share, allowing user to copy results or poll link', async () => {
    vi.mocked(pollService.subscribeToLedger).mockImplementationOnce((_session, cb) => {
      cb({
        pollId: 'p1',
        metadata: {
          title: 'Share Test Poll',
          organizerName: 'Organizer',
          schedulingMode: 'EXACT',
          timeSlots: [{ id: 't1', startTime: '2026-01-01T10:00:00Z', endTime: '2026-01-01T11:00:00Z' }]
        },
        votes: new Map(),
        isFinalized: false
      } as any, 'Synced');
      return () => {};
    });

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    });

    vi.mocked(pollService.getShareableUrl).mockImplementation(() => 'http://localhost/poll/mock-poll-id-123/results#key=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=');

    renderPage();

    expect(await screen.findByText('Share Test Poll')).toBeInTheDocument();

    const shareButton = screen.getByTestId('share-button');
    expect(shareButton).toBeInTheDocument();
    shareButton.click();

    expect(await screen.findByText('Share this Poll')).toBeInTheDocument();
    expect(await screen.findByText('Which link would you like to copy?')).toBeInTheDocument();

    const pollLinkBtn = screen.getByTestId('share-poll-link-btn');
    pollLinkBtn.click();

    expect(mockWriteText).toHaveBeenCalled();
    const copiedVal = mockWriteText.mock.calls[0][0];
    expect(copiedVal).toContain('/poll/mock-poll-id-123');
    expect(copiedVal).not.toContain('/results');
  });
});
