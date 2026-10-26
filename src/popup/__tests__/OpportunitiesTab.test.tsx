import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OpportunitiesTab from '../components/OpportunitiesTab';
import { ToastProvider } from '../components/Toast';
import { makeOpportunity } from '../../test/fixtures';

const opportunities = [
  makeOpportunity({ id: 'o1', name: 'Website revamp', stage: 'New', probability: 10, revenue: 12000 }),
  makeOpportunity({ id: 'o2', name: 'Support plan', stage: 'Won', probability: 100, revenue: 4500 }),
  makeOpportunity({ id: 'o3', name: 'ERP rollout', stage: 'Proposition', probability: 60, revenue: 1250000 }),
];

function renderTab(onDelete = vi.fn()) {
  render(
    <ToastProvider>
      <OpportunitiesTab opportunities={opportunities} onDelete={onDelete} onDeleteAll={vi.fn()} />
    </ToastProvider>,
  );
  return { onDelete };
}

const names = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('OpportunitiesTab', () => {
  it('formats revenue in rupees with Indian digit grouping, and probability as a percentage', () => {
    renderTab();
    const erpRow = screen.getByText('ERP rollout').closest('tr')!;
    expect(within(erpRow).getByText('₹12,50,000')).toBeTruthy();
    expect(within(erpRow).getByText('60%')).toBeTruthy();
  });

  it('filters by stage', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText<HTMLSelectElement>('Stage:', { selector: 'select' }), 'Won');

    expect(names()).toEqual(['Support plan']);
  });

  it('keeps only opportunities inside the probability range', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.type(screen.getByPlaceholderText('Min %'), '50');
    expect(names()).toEqual(['Support plan', 'ERP rollout']);

    await user.type(screen.getByPlaceholderText('Max %'), '60');
    expect(names()).toEqual(['ERP rollout']);
  });

  it('searches by name or stage and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.type(screen.getByPlaceholderText(/Search by name or stage/), 'propos');
    expect(names()).toEqual(['ERP rollout']);

    await user.clear(screen.getByPlaceholderText(/Search by name or stage/));
    await user.type(screen.getByPlaceholderText(/Search by name or stage/), 'nothing like this');
    expect(screen.getByText('No opportunities match your filter')).toBeTruthy();
  });

  it('sorts by revenue when its header is clicked, and flips on a second click', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('columnheader', { name: 'Revenue' }));
    expect(names()).toEqual(['Support plan', 'Website revamp', 'ERP rollout']);

    await user.click(screen.getByRole('columnheader', { name: 'Revenue' }));
    expect(names()).toEqual(['ERP rollout', 'Website revamp', 'Support plan']);
  });

  it('deletes a row only after the user confirms', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { onDelete } = renderTab();
    const deleteSupportPlan = () =>
      user.click(within(screen.getByText('Support plan').closest('tr')!).getByTitle('Delete this record'));

    await deleteSupportPlan();
    expect(onDelete).not.toHaveBeenCalled();

    await deleteSupportPlan();
    expect(confirm).toHaveBeenLastCalledWith('Delete "Support plan"?');
    expect(onDelete).toHaveBeenCalledWith('o2');
  });
});
