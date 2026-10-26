import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountIndicator, setIndicatorState, unmountIndicator } from '../indicator';

const host = () => document.getElementById('swades-shadow-indicator');

// The shadow root is closed, so the tests reach it through attachShadow's return value.
let roots: ShadowRoot[] = [];
const originalAttach = Element.prototype.attachShadow;

beforeEach(() => {
  roots = [];
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
    const root = originalAttach.call(this, init);
    roots.push(root);
    return root;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  unmountIndicator();
});

const root = () => roots[roots.length - 1];
const text = () => root().querySelector('.text')!.textContent;
const dot = () => root().querySelector<HTMLElement>('.dot')!;

describe('indicator', () => {
  it('mounts one fixed host with a closed shadow root, and ignores a second mount', () => {
    mountIndicator();
    mountIndicator();

    expect(document.querySelectorAll('#swades-shadow-indicator')).toHaveLength(1);
    expect(host()!.style.position).toBe('fixed');
    expect(host()!.shadowRoot).toBeNull();
    expect(text()).toBe('Idle');
    expect(root().querySelector('.indicator')!.classList.contains('hidden')).toBe(false);
  });

  it('replaces a host left by an earlier copy of the content script instead of throwing', () => {
    const stale = document.createElement('div');
    stale.id = 'swades-shadow-indicator';
    stale.attachShadow({ mode: 'closed' });
    document.body.appendChild(stale);

    expect(() => mountIndicator()).not.toThrow();

    expect(document.querySelectorAll('#swades-shadow-indicator')).toHaveLength(1);
    expect(host()).not.toBe(stale);
  });

  it('shows each state with its colour, and pulses only while extracting', () => {
    mountIndicator();

    setIndicatorState('extracting', 'Extracting contacts...');
    expect(text()).toBe('Extracting contacts...');
    expect(dot().classList.contains('extracting')).toBe(true);
    expect(dot().style.background).toBe('rgb(245, 158, 11)');

    setIndicatorState('error');
    expect(text()).toBe('Error');
    expect(dot().classList.contains('extracting')).toBe(false);
    expect(dot().style.background).toBe('rgb(151, 49, 49)');
  });

  it('returns to idle two seconds after a success', () => {
    vi.useFakeTimers();
    mountIndicator();

    setIndicatorState('success', 'Done');
    vi.advanceTimersByTime(1999);
    expect(text()).toBe('Done');

    vi.advanceTimersByTime(1);
    expect(text()).toBe('Idle');
  });

  it('does nothing before it is mounted', () => {
    expect(() => setIndicatorState('success')).not.toThrow();
    expect(host()).toBeNull();
  });

  it('removes the host and its pending idle timer on unmount', () => {
    vi.useFakeTimers();
    mountIndicator();
    setIndicatorState('success');

    unmountIndicator();
    vi.advanceTimersByTime(5000);

    expect(host()).toBeNull();
  });
});
