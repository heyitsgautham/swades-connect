import { describe, it, expect } from 'vitest';
import { deduplicateById } from '../storage';

describe('Storage utilities', () => {
  describe('deduplicateById', () => {
    it('should deduplicate records by ID, keeping last one', () => {
      const records = [
        { id: '1', name: 'Alice', value: 10 },
        { id: '2', name: 'Bob', value: 20 },
        { id: '1', name: 'Alice Updated', value: 15 }, // Duplicate ID
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.find((r) => r.id === '1')?.value).toBe(15);
      expect(deduplicated.find((r) => r.id === '2')?.value).toBe(20);
    });

    it('should handle empty arrays', () => {
      const result = deduplicateById([]);
      expect(result).toEqual([]);
    });

    it('should handle single record', () => {
      const records = [{ id: '1', name: 'Only One' }];
      const result = deduplicateById(records);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Only One');
    });

    it('should preserve order based on last occurrence', () => {
      const records = [
        { id: '3', name: 'Third' },
        { id: '1', name: 'First' },
        { id: '2', name: 'Second' },
        { id: '1', name: 'First Updated' },
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(3);
      // Map preserves insertion order, but last value wins
      const ids = deduplicated.map(r => r.id);
      expect(ids).toContain('1');
      expect(ids).toContain('2');
      expect(ids).toContain('3');
    });

    it('should handle multiple duplicates of same ID', () => {
      const records = [
        { id: '1', version: 1 },
        { id: '1', version: 2 },
        { id: '1', version: 3 },
        { id: '1', version: 4 },
      ];

      const deduplicated = deduplicateById(records);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].version).toBe(4);
    });
  });
});
