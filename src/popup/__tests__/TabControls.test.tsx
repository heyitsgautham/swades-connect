import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportBar, FilterSelect } from '../components/TabControls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

const buttons = () => Array.from(container.querySelectorAll('button'));
const byText = (text: string) => buttons().find((b) => b.textContent?.includes(text))!;

describe('ExportBar', () => {
  it('exports in the chosen format and deletes all', () => {
    const onExport = vi.fn();
    const onDeleteAll = vi.fn();
    act(() => root.render(<ExportBar recordCount={2} onExport={onExport} onDeleteAll={onDeleteAll} />));

    act(() => byText('CSV').click());
    act(() => byText('JSON').click());
    act(() => byText('Delete All').click());

    expect(onExport.mock.calls).toEqual([['csv'], ['json']]);
    expect(onDeleteAll).toHaveBeenCalledOnce();
  });

  it('disables every button when there are no records', () => {
    act(() => root.render(<ExportBar recordCount={0} onExport={vi.fn()} onDeleteAll={vi.fn()} />));
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});

describe('FilterSelect', () => {
  it('renders its options and reports changes', () => {
    const onChange = vi.fn();
    act(() =>
      root.render(
        <FilterSelect
          label="Stage:"
          value=""
          onChange={onChange}
          options={[
            { value: '', label: 'All Stages' },
            { value: 'Won', label: 'Won' },
          ]}
        />,
      ),
    );

    const select = container.querySelector('select')!;
    expect(Array.from(select.options, (o) => o.textContent)).toEqual(['All Stages', 'Won']);

    act(() => {
      select.value = 'Won';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('Won');
  });

  it('labels its select, so clicking the label focuses it and screen readers name it', () => {
    act(() =>
      root.render(<FilterSelect label="Stage:" value="" onChange={vi.fn()} options={[{ value: '', label: 'All' }]} />),
    );

    const label = container.querySelector('label')!;
    const select = container.querySelector('select')!;
    expect(select.id).not.toBe('');
    expect(label.htmlFor).toBe(select.id);
    expect(select.labels?.[0]?.textContent).toBe('Stage:');
  });
});
