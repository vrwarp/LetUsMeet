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
