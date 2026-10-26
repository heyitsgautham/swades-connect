import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { useToast } from '../hooks/useToast';

function ShowButtons() {
  const { showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast({ type: 'success', message: 'Saved' })}>ok</button>
      <button onClick={() => showToast({ type: 'error', message: 'Broke' })}>fail</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  render(
    <ToastProvider>
      <ShowButtons />
    </ToastProvider>,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('stacks toasts and removes each one about 3.3 seconds after it appears', () => {
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByText('fail'));
    expect(screen.getAllByRole('alert').map((toast) => toast.textContent)).toEqual(['Saved', 'Broke']);

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('removes a toast early when its dismiss button is clicked', () => {
    fireEvent.click(screen.getByText('ok'));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('colours success and error toasts differently', () => {
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByText('fail'));
    const [success, error] = screen.getAllByRole('alert');

    expect(success.className).toContain('bg-success');
    expect(error.className).toContain('bg-error');
  });
});

describe('useToast', () => {
  it('throws outside a ToastProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider');
  });
});
