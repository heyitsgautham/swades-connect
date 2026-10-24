import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDateISO,
  generateContentHash,
  mapActivityType,
  normalizeDate,
  parseCompleteName,
  parseRelativeDate,
  parseRevenue,
} from '../parsing';

describe('generateContentHash', () => {
  it('is stable for the same content and prefixed', () => {
    const a = generateContentHash('opp', 'Widget order', 'Qualified', 500);
    expect(a).toMatch(/^opp_[0-9a-z]+$/);
    expect(generateContentHash('opp', 'Widget order', 'Qualified', 500)).toBe(a);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(generateContentHash('act', '  Call Back ', 'call')).toBe(generateContentHash('act', 'call back', 'CALL'));
  });

  it('changes when any part changes', () => {
    expect(generateContentHash('opp', 'Widget order', 'Won', 500)).not.toBe(
      generateContentHash('opp', 'Widget order', 'Qualified', 500),
    );
  });
});

describe('parseCompleteName', () => {
  it('splits "Company, Person" into its parts', () => {
    expect(parseCompleteName('Acme Widgets, Mira Testwell')).toEqual({ name: 'Mira Testwell', company: 'Acme Widgets' });
  });

  it('keeps a name without a comma whole', () => {
    expect(parseCompleteName('  Mira Testwell ')).toEqual({ name: 'Mira Testwell', company: '' });
  });

  it('does not split when either side of the comma is empty', () => {
    expect(parseCompleteName(', Mira')).toEqual({ name: ', Mira', company: '' });
    expect(parseCompleteName('Acme,')).toEqual({ name: 'Acme,', company: '' });
  });

  it('splits on the first comma only', () => {
    expect(parseCompleteName('Acme, Mira, Jr.')).toEqual({ name: 'Mira, Jr.', company: 'Acme' });
  });

  it('returns empty parts for an empty string', () => {
    expect(parseCompleteName('')).toEqual({ name: '', company: '' });
  });
});

describe('parseRevenue', () => {
  it.each([
    ['₹ 1,234.56', 1234.56],
    ['$ 0.00', 0],
    ['€12,000', 12000],
    ['£ 7.5', 7.5],
    ['', 0],
    ['n/a', 0],
  ])('parses %j as %d', (input, expected) => {
    expect(parseRevenue(input)).toBe(expected);
  });
});

describe('mapActivityType', () => {
  it.each([
    ['Call', 'call'],
    ['Phone follow-up', 'call'],
    ['Meeting', 'meeting'],
    ['Email', 'email'],
    ['Send mail', 'email'],
    ['To-Do', 'todo'],
    ['Upload Document', 'todo'],
    ['', 'todo'],
  ] as const)('maps %j to %s', (input, expected) => {
    expect(mapActivityType(input)).toBe(expected);
  });
});

describe('normalizeDate', () => {
  it.each([
    ['2026-02-14', '2026-02-14'],
    ['2026-02-14 09:30:00', '2026-02-14'],
    ['14/02/2026', '2026-02-14'],
    ['4/2/2026', '2026-02-04'],
    ['02-14-2026', '2026-02-14'],
    ['next week', 'next week'],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });
});

describe('parseRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['Today', '2026-01-31'],
    ['Yesterday', '2026-01-30'],
    ['Tomorrow', '2026-02-01'],
    ['In 3 days', '2026-02-03'],
    ['in 1 day', '2026-02-01'],
    ['2 days ago', '2026-01-29'],
  ])('turns %j into %s', (input, expected) => {
    expect(parseRelativeDate(input)).toBe(expected);
  });

  it('returns unrecognised text unchanged', () => {
    expect(parseRelativeDate('Someday')).toBe('Someday');
  });
});

describe('formatDateISO', () => {
  it('zero-pads month and day', () => {
    expect(formatDateISO(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
});
