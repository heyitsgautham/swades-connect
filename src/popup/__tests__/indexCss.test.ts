/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Read from disk, relative to the repo root vitest runs in: vitest swaps CSS imports, ?raw included, for an empty string.
const css = readFileSync('src/popup/index.css', 'utf8');

/** Names of the @layer blocks each top-level rule sits in, keyed by its selector. */
function layersBySelector(source: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const stack: string[] = [];
  let pending = '';
  for (const char of source.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const head = pending.trim();
      if (!head.startsWith('@'))
        found.set(
          head,
          stack.filter((entry) => entry.startsWith('@layer')),
        );
      stack.push(head);
      pending = '';
    } else if (char === '}') {
      stack.pop();
      pending = '';
    } else if (char === ';') {
      pending = '';
    } else {
      pending += char;
    }
  }
  return found;
}

describe('popup index.css', () => {
  const layers = layersBySelector(css);

  // Chrome adds an unlayered body { font-family: system-ui; font-size: 75% } to extension pages,
  // which beats a layered body rule and turned the whole popup into 12px system-ui.
  it('keeps the body rule outside every cascade layer', () => {
    expect(layers.get('body')).toEqual([]);
  });

  it('keeps the reset in the base layer, so utility classes can override it', () => {
    expect(layers.get('*')).toEqual(['@layer base']);
  });
});
