import { beforeEach, describe, expect, it } from 'vitest';
import { extractOpportunities } from '../opportunityExtractor';
import { clearOpportunityIdCache, populateOpportunityIdCache } from '../../idCache';
import { generateContentHash } from '../../parsing';
import { leadKanbanColumns, leadListRows, render } from '../../../test/odooDom';
import { chromeMock } from '../../../test/chromeMock';

beforeEach(() => {
  clearOpportunityIdCache();
});

describe('extractOpportunities from the list view', () => {
  it('parses name, revenue, stage, probability and deadline', async () => {
    render(
      leadListRows([
        { name: 'Widget bulk order', revenue: '₹ 12,500.00', stage: 'Qualified', probability: '40.00', deadline: '2026-03-31' },
      ]),
    );

    const [opp] = await extractOpportunities();
    expect(opp).toMatchObject({
      name: 'Widget bulk order',
      revenue: 12500,
      stage: 'Qualified',
      probability: 40,
      closeDate: '2026-03-31',
    });
  });

  it('uses the real Odoo id when web_search_read has cached it', async () => {
    populateOpportunityIdCache([{ id: 77, name: 'Widget bulk order' }]);
    render(leadListRows([{ name: 'Widget bulk order', stage: 'New' }]));

    expect((await extractOpportunities())[0].id).toBe('opp_77');
  });

  it('seeds the id cache from opportunities already in storage', async () => {
    await chromeMock().storage.local.set({
      odoo_data: { contacts: [], activities: [], lastSync: 0, opportunities: [{ id: 'opp_88', name: 'Stored deal' }] },
    });
    render(leadListRows([{ name: 'Stored deal', stage: 'New' }]));

    expect((await extractOpportunities())[0].id).toBe('opp_88');
  });

  it('falls back to a content hash of name, stage and revenue', async () => {
    render(leadListRows([{ name: 'Unknown deal', revenue: '$ 10.00', stage: 'New' }]));

    expect((await extractOpportunities())[0].id).toBe(generateContentHash('opp', 'Unknown deal', 'New', 10));
  });

  it('defaults missing stage and numbers', async () => {
    render(leadListRows([{ name: 'Bare deal' }]));
    expect((await extractOpportunities())[0]).toMatchObject({ revenue: 0, stage: 'Unknown', probability: 0, closeDate: '' });
  });
});

describe('extractOpportunities from the kanban view', () => {
  it('takes the stage from each column header', async () => {
    render(
      leadKanbanColumns([
        { stage: 'New', cards: [{ name: 'First deal', revenue: '$ 1,000.00' }] },
        { stage: 'Won', cards: [{ name: 'Second deal' }, { name: 'Third deal', revenue: '€ 3.50' }] },
      ]),
    );

    const result = await extractOpportunities();
    expect(result.map((o) => [o.name, o.stage, o.revenue])).toEqual([
      ['First deal', 'New', 1000],
      ['Second deal', 'Won', 0],
      ['Third deal', 'Won', 3.5],
    ]);
  });

  it('turns filled priority stars into a probability', async () => {
    render(
      leadKanbanColumns([
        {
          stage: 'New',
          cards: [
            { name: 'Zero', stars: 0 },
            { name: 'One', stars: 1 },
            { name: 'Two', stars: 2 },
            { name: 'Three', stars: 3 },
          ],
        },
      ]),
    );

    const result = await extractOpportunities();
    expect(result.map((o) => o.probability)).toEqual([0, 33, 67, 100]);
  });

  it('returns nothing on a page with neither view', async () => {
    render('<div class="o_form_view"></div>');
    expect(await extractOpportunities()).toEqual([]);
  });
});
