import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ActivitiesTab from '../components/ActivitiesTab';
import { ToastProvider } from '../components/Toast';
import { makeActivity } from '../../test/fixtures';

const activities = [
  makeActivity({
    id: 'a1',
    type: 'call',
    summary: 'Intro call',
    dueDate: '2026-10-28',
    assignedTo: 'Mira',
    status: 'open',
  }),
  makeActivity({
    id: 'a2',
    type: 'meeting',
    summary: 'Demo',
    dueDate: '2026-10-21',
    assignedTo: 'Sam',
    status: 'done',
  }),
  makeActivity({
    id: 'a3',
    type: 'email',
    summary: 'Send quote',
    dueDate: '2026-10-30',
    assignedTo: 'Mira',
    status: 'open',
  }),
  makeActivity({ id: 'a4', type: 'todo', summary: 'Follow up', dueDate: '', assignedTo: '', status: 'open' }),
];

function renderTab(onDelete = vi.fn()) {
  render(
    <ToastProvider>
      <ActivitiesTab activities={activities} onDelete={onDelete} onDeleteAll={vi.fn()} />
    </ToastProvider>,
  );
  return { onDelete };
}

const summaries = () =>
  screen.queryAllByTitle('Remove from storage').map((button) => button.parentElement!.children[1].textContent);

describe('ActivitiesTab', () => {
  it('shows placeholders for a missing due date and assignee', () => {
    renderTab();
    const card = screen.getByText('Follow up').closest('div.relative') as HTMLElement;
    expect(within(card).getByText('Due: No date')).toBeTruthy();
    expect(within(card).getByText('Assigned: Unassigned')).toBeTruthy();
  });

  it('combines the status and type filters', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status:'), 'open');
    expect(summaries()).toEqual(['Intro call', 'Send quote', 'Follow up']);

    await user.selectOptions(screen.getByLabelText('Type:'), 'email');
    expect(summaries()).toEqual(['Send quote']);
  });

  it('searches the summary, type and assignee', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.type(screen.getByPlaceholderText(/Search by summary/), 'mira');
    expect(summaries()).toEqual(['Intro call', 'Send quote']);
    expect(screen.getByText('2 results')).toBeTruthy();
  });

  it('sorts by due date and flips the direction with the Asc button', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Sort by:'), 'dueDate');
    expect(summaries()).toEqual(['Follow up', 'Demo', 'Intro call', 'Send quote']);

    await user.click(screen.getByRole('button', { name: '▲ Asc' }));
    expect(summaries()).toEqual(['Send quote', 'Intro call', 'Demo', 'Follow up']);
    expect(screen.getByRole('button', { name: '▼ Desc' })).toBeTruthy();
  });

  it('hides the direction button while the default order is selected', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: /Asc|Desc/ })).toBeNull();
  });

  it('says when no activity matches the filters', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status:'), 'done');
    await user.selectOptions(screen.getByLabelText('Type:'), 'call');

    expect(screen.getByText('No activities match your filter')).toBeTruthy();
  });

  it('removes an activity after the user confirms', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onDelete } = renderTab();

    await user.click(screen.getAllByTitle('Remove from storage')[1]);

    expect(confirm).toHaveBeenCalledWith('Delete activity "Demo"?');
    expect(onDelete).toHaveBeenCalledWith('a2');
  });
});
