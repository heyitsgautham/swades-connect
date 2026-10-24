import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * Sort records by one field. An empty key keeps the original order.
 * Missing values sort as empty strings, and the input array is not mutated.
 */
export function sortRecords<T extends object>(records: T[], key: string, direction: SortDirection): T[] {
  if (!key) return records;
  return [...records].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[key] ?? '';
    const bVal = (b as Record<string, unknown>)[key] ?? '';
    const cmp =
      (aVal as string | number) < (bVal as string | number)
        ? -1
        : (aVal as string | number) > (bVal as string | number)
          ? 1
          : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}

/**
 * Sort state for a tab. Choosing the active key again flips the direction;
 * choosing a new key sorts ascending.
 */
export function useSort<T extends object>(records: T[]) {
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const toggleDirection = () => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));

  const sorted = useMemo(() => sortRecords(records, sortKey, sortDirection), [records, sortKey, sortDirection]);

  return { sorted, sortKey, sortDirection, handleSort, toggleDirection };
}
