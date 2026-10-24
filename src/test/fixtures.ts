import type { Activity, Contact, Opportunity } from '../shared/types';

// Synthetic CRM records. Names, companies and addresses are invented;
// email domains use the reserved example.com / example.org.

export function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact_101',
    name: 'Mira Testwell',
    email: 'mira.testwell@example.com',
    phone: '+1 555 0101',
    company: 'Acme Widgets',
    country: 'Testland',
    ...overrides,
  };
}

export function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp_201',
    name: 'Widget bulk order',
    revenue: 12500,
    stage: 'Qualified',
    probability: 40,
    closeDate: '2026-03-31',
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act_301',
    type: 'call',
    summary: 'Follow up on quote',
    dueDate: '2026-02-14',
    assignedTo: 'Sam Placeholder',
    status: 'open',
    ...overrides,
  };
}
