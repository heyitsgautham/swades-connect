import { describe, expect, it } from 'vitest';
import { sortRecords } from '../hooks/useSort';
import { makeOpportunity } from '../../test/fixtures';

const opps = [
  makeOpportunity({ id: 'b', name: 'Beta', revenue: 300 }),
  makeOpportunity({ id: 'a', name: 'Alpha', revenue: 1000 }),
  makeOpportunity({ id: 'c', name: 'Gamma', revenue: 20 }),
];

describe('sortRecords', () => {
  it('keeps the original order without a key', () => {
    expect(sortRecords(opps, '', 'asc')).toBe(opps);
  });

  it('sorts strings and numbers in either direction', () => {
    expect(sortRecords(opps, 'name', 'asc').map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(sortRecords(opps, 'revenue', 'asc').map((o) => o.id)).toEqual(['c', 'b', 'a']);
    expect(sortRecords(opps, 'revenue', 'desc').map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its input', () => {
    sortRecords(opps, 'name', 'asc');
    expect(opps.map((o) => o.id)).toEqual(['b', 'a', 'c']);
  });
});
