// Builders for small, synthetic Odoo 19 list and kanban markup.
// They copy only the selectors the extractors read, not whole saved pages,
// and every person, company and address in them is invented.

export function render(html: string): void {
  document.body.innerHTML = html;
}

const attr = (name: string, value: string | undefined) => (value === undefined ? '' : ` ${name}="${value}"`);

export interface ContactRow {
  partnerId?: number;
  completeName: string;
  email?: string;
  phone?: string;
  company?: string;
  country?: string;
  /** Put values in text only, without data-tooltip. */
  textOnly?: boolean;
}

export function contactListRows(rows: ContactRow[]): string {
  const cell = (name: string, value: string | undefined, textOnly?: boolean) =>
    `<td name="${name}"${textOnly ? '' : attr('data-tooltip', value)}>${value ?? ''}</td>`;
  const body = rows
    .map(
      (r) => `<tr class="o_data_row">
        <td name="avatar_128">${r.partnerId ? `<img src="/web/image/res.partner/${r.partnerId}/avatar_128">` : ''}</td>
        ${cell('complete_name', r.completeName, r.textOnly)}
        ${cell('email', r.email, r.textOnly)}
        ${cell('phone', r.phone, r.textOnly)}
        ${r.company !== undefined ? cell('parent_id', r.company, r.textOnly) : ''}
        ${cell('country_id', r.country, r.textOnly)}
      </tr>`,
    )
    .join('');
  return `<div class="o_list_view"><table><tbody>${body}</tbody></table></div>`;
}

export interface ContactCard {
  partnerId?: number;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  company?: string;
}

export function contactKanbanCards(cards: ContactCard[]): string {
  const iconLine = (icon: string, value: string | undefined, extraEmptySpan = false) =>
    value === undefined
      ? ''
      : `<div><i class="fa fa-fw me-1 ${icon} text-primary"></i>${extraEmptySpan ? '<span></span> ' : ''}<span>${value}</span></div>`;
  const body = cards
    .map(
      (c) => `<article class="o_kanban_record">
        ${c.partnerId ? `<aside><img src="/web/image/res.partner/${c.partnerId}/avatar_128"></aside>` : ''}
        <main>
          <div class="mb-1"><span class="mb-0 fw-bold fs-5">${c.name}</span></div>
          ${c.company !== undefined ? `<div data-field="parent_id">${c.company}</div>` : ''}
          ${iconLine('fa-envelope', c.email)}
          ${iconLine('fa-phone', c.phone)}
          ${iconLine('fa-map-marker', c.country, true)}
        </main>
      </article>`,
    )
    .join('');
  return `<div class="o_kanban_view">${body}</div>`;
}

export interface LeadRow {
  name: string;
  revenue?: string;
  stage?: string;
  probability?: string;
  deadline?: string;
}

export function leadListRows(rows: LeadRow[]): string {
  const body = rows
    .map(
      (r) => `<tr class="o_data_row">
        <td name="name" data-tooltip="${r.name}">${r.name}</td>
        <td name="contact_name" data-tooltip="Sam Placeholder">Sam Placeholder</td>
        <td name="email_from" data-tooltip="sam@example.org">sam@example.org</td>
        <td name="expected_revenue"><div><span>${r.revenue ?? ''}</span></div></td>
        <td name="stage_id"${attr('data-tooltip', r.stage)}>${r.stage ?? ''}</td>
        ${r.probability !== undefined ? `<td name="probability">${r.probability}</td>` : ''}
        ${r.deadline !== undefined ? `<td name="date_deadline">${r.deadline}</td>` : ''}
      </tr>`,
    )
    .join('');
  return `<div class="o_list_view"><table><tbody>${body}</tbody></table></div>`;
}

export interface LeadCard {
  name: string;
  revenue?: string;
  stars?: number;
  partner?: string;
}

export function leadKanbanColumns(columns: { stage: string; cards: LeadCard[] }[]): string {
  const stars = (filled: number) =>
    [0, 1, 2].map((i) => `<a class="o_priority_star fa ${i < filled ? 'fa-star' : 'fa-star-o'}"></a>`).join('');
  const card = (c: LeadCard) => `<article class="o_kanban_record">
      <span class="fw-bold fs-5">${c.name}</span>
      <div class="o_kanban_card_crm_lead_revenue">${c.revenue ?? ''}</div>
      <div class="d-flex"><div name="partner_id"></div><span class="ms-2 text-truncate">${c.partner ?? ''}</span></div>
      <footer><div name="priority">${stars(c.stars ?? 0)}</div></footer>
    </article>`;
  const body = columns
    .map(
      (col) => `<div class="o_kanban_group">
        <div class="o_kanban_header"><div class="o_column_title"><span class="text-truncate">${col.stage}</span></div></div>
        ${col.cards.map(card).join('')}
      </div>`,
    )
    .join('');
  return `<div class="o_kanban_view">${body}</div>`;
}

export interface ActivityRow {
  summary: string;
  type?: string;
  user?: string;
  deadlineTitle?: string;
  deadlineText?: string;
  done?: boolean;
}

export function activityListRows(rows: ActivityRow[]): string {
  const body = rows
    .map(
      (r) => `<tr class="o_data_row${r.done ? ' o_activity_done' : ''}">
        <td name="res_name" data-tooltip="Widget bulk order">Widget bulk order</td>
        <td name="summary" data-tooltip="${r.summary}">${r.summary}</td>
        <td name="activity_type_id"${attr('data-tooltip', r.type)}>${r.type ?? ''}</td>
        <td name="user_id"><div class="o_many2one"><img src="/web/image/res.users/2/avatar_128"><span>${r.user ?? ''}</span></div></td>
        <td name="date_deadline">${r.deadlineTitle ? `<div title="${r.deadlineTitle}">soon</div>` : (r.deadlineText ?? '')}</td>
      </tr>`,
    )
    .join('');
  return `<div class="o_list_view"><table><tbody>${body}</tbody></table></div>`;
}

export interface ActivityCard {
  summary?: string;
  linkedRecord?: string;
  type?: string;
  userTitle?: string;
  userText?: string;
  deadlineTitle?: string;
  done?: boolean;
}

export function activityKanbanCards(cards: ActivityCard[]): string {
  const body = cards
    .map(
      (c) => `<article class="o_kanban_record${c.done ? ' o_activity_done' : ''}">
        <div class="d-flex"><span class="fw-bold text-truncate">${c.linkedRecord ?? ''}</span><span class="text-muted">Lead</span></div>
        ${c.summary !== undefined ? `<span class="text-truncate">${c.summary}</span>` : ''}
        <span class="badge"><span>${c.type ?? ''}</span></span>
        <footer><div name="user_id">${c.userTitle ? `<img title="${c.userTitle}">` : ''}${c.userText ? `<span>${c.userText}</span>` : ''}</div></footer>
        ${c.deadlineTitle ? `<div name="date_deadline" title="${c.deadlineTitle}">In 2 days</div>` : ''}
      </article>`,
    )
    .join('');
  return `<div class="o_kanban_view">${body}</div>`;
}
