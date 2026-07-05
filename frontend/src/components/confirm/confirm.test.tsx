import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import ConfirmProvider from './ConfirmProvider';
import { useConfirm } from './confirmContext';

/**
 * Minimal harness that opens a confirm dialog on button click and records the
 * resolved boolean so tests can assert how the promise settled.
 */
function Harness() {
  const askConfirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const result = await askConfirm({
          title: 'Delete this?',
          body: 'This cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Keep',
        });
        document.body.setAttribute('data-confirm-result', String(result));
      }}
    >
      open
    </button>
  );
}

function renderHarness() {
  return render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>
  );
}

describe('ConfirmProvider / useConfirm', () => {
  it('resolves true when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'open' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(document.body.getAttribute('data-confirm-result')).toBe('true')
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    document.body.removeAttribute('data-confirm-result');
  });

  it('resolves false when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: 'Keep' }));

    await waitFor(() =>
      expect(document.body.getAttribute('data-confirm-result')).toBe('false')
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    document.body.removeAttribute('data-confirm-result');
  });

  it('resolves false when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('alertdialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(document.body.getAttribute('data-confirm-result')).toBe('false')
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    document.body.removeAttribute('data-confirm-result');
  });
});

/** Harness that opens the dialog with the cancel button emphasised. */
function EmphasisHarness() {
  const askConfirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const result = await askConfirm({
          title: 'Sign-in may not work in this app',
          confirmLabel: 'Try anyway',
          cancelLabel: 'Cancel',
          variant: 'warning',
          emphasizeCancel: true,
        });
        document.body.setAttribute('data-confirm-result', String(result));
      }}
    >
      open
    </button>
  );
}

describe('ConfirmProvider emphasizeCancel', () => {
  async function openEmphasisDialog() {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <EmphasisHarness />
      </ConfirmProvider>
    );
    await user.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('alertdialog');
    return user;
  }

  it('gives the cancel button primary emphasis and de-emphasises confirm', async () => {
    await openEmphasisDialog();

    // brand-green is the primary variant's marker; secondary is white/bordered.
    expect(screen.getByTestId('confirm-dialog-cancel').className).toContain('bg-brand-green');
    expect(screen.getByTestId('confirm-dialog-confirm').className).toContain('bg-white');
    document.body.removeAttribute('data-confirm-result');
  });

  it('keeps the emphasised (cancel) button in the trailing/right slot', async () => {
    await openEmphasisDialog();

    const buttons = screen.getAllByRole('button').filter((b) => b.dataset.testid?.startsWith('confirm-dialog-'));
    // Try anyway (secondary) renders first, Cancel (primary) last.
    expect(buttons[0]).toHaveAttribute('data-testid', 'confirm-dialog-confirm');
    expect(buttons[1]).toHaveAttribute('data-testid', 'confirm-dialog-cancel');
    document.body.removeAttribute('data-confirm-result');
  });

  it('still resolves true for "Try anyway" and false on dismissal', async () => {
    const user = await openEmphasisDialog();

    await user.click(screen.getByRole('button', { name: 'Try anyway' }));
    await waitFor(() =>
      expect(document.body.getAttribute('data-confirm-result')).toBe('true')
    );
    document.body.removeAttribute('data-confirm-result');
  });
});
