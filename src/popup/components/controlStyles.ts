import type { CSSProperties } from 'react';

// Input styles shared by the tab filter controls.

export const fieldStyle: CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  border: '1px solid var(--color-border)',
  borderRadius: '0px',
  fontSize: '12px',
  outline: 'none',
};

export const selectStyle: CSSProperties = { ...fieldStyle, cursor: 'pointer' };
