import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectDataModel, detectViewType, getOdooVersion, getViewContext, isOdooPage, waitForOdooReady } from '../viewDetector';
import { render } from '../../test/odooDom';

function visit(path: string) {
  window.history.replaceState({}, '', path);
}

afterEach(() => {
  visit('/');
  document.title = '';
});

describe('detectViewType', () => {
  it.each([
    ['<div class="o_activity_view"><div class="o_list_view"></div></div>', 'activity'],
    ['<div class="o_list_view"></div>', 'list'],
    ['<div class="o_kanban_view"></div>', 'kanban'],
    ['<div class="o_form_view"></div>', 'form'],
    ['<div></div>', 'unknown'],
  ])('reads %s as %s', (html, expected) => {
    render(html);
    expect(detectViewType()).toBe(expected);
  });
});

describe('detectDataModel', () => {
  it.each([
    ['/odoo/action-1?model=crm.lead', 'crm.lead'],
    ['/odoo/contacts/', 'res.partner'],
    ['/odoo/crm/', 'crm.lead'],
    ['/odoo/activities/', 'mail.activity'],
    ['/web#model=mail.activity', 'mail.activity'],
  ])('reads the url %s as %s', (path, expected) => {
    visit(path);
    expect(detectDataModel()).toBe(expected);
  });

  it('falls back to resModel in data-tooltip-info', () => {
    render(`<span data-tooltip-info='not json'></span><span data-tooltip-info='{"resModel":"mail.activity"}'></span>`);
    expect(detectDataModel()).toBe('mail.activity');
  });

  it('falls back to the page title', () => {
    document.title = 'Pipeline - Odoo';
    expect(detectDataModel()).toBe('crm.lead');
    document.title = 'Customers';
    expect(detectDataModel()).toBe('res.partner');
  });

  it('returns unknown when nothing matches', () => {
    expect(detectDataModel()).toBe('unknown');
  });
});

describe('Odoo page helpers', () => {
  it('reads the server version from an inline session script', () => {
    render(`<script>var odoo = { "server_version": "19.0+e" };</script>`);
    expect(getOdooVersion()).toBe('19.0+e');
  });

  it('reads the version from data-version', () => {
    render('<div data-version="18.0"></div>');
    expect(getOdooVersion()).toBe('18.0');
  });

  it('detects Odoo pages by their containers', () => {
    expect(isOdooPage()).toBe(false);
    render('<div class="o_action_manager"></div>');
    expect(isOdooPage()).toBe(true);
  });

  it('collects the context in one object', () => {
    render('<div class="o_kanban_view"></div>');
    visit('/odoo/crm/');
    expect(getViewContext()).toMatchObject({ viewType: 'kanban', dataModel: 'crm.lead', version: 'unknown' });
  });

  it('waitForOdooReady resolves once the client is visible and rejects on timeout', async () => {
    vi.useFakeTimers();
    render('<div class="o_web_client"></div>');
    const failing = waitForOdooReady(300);
    const assertion = expect(failing).rejects.toThrow(/Timeout/);
    await vi.advanceTimersByTimeAsync(400);
    await assertion;

    Object.defineProperty(document.querySelector('.o_web_client'), 'offsetHeight', { value: 10 });
    await expect(waitForOdooReady(300)).resolves.toBeUndefined();
  });
});
