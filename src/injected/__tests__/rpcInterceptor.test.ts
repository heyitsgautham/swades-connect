import { describe, expect, it, vi } from 'vitest';
import {
  injectRpcInterceptor,
  isOdooRpcSignal,
  isRelevantModel,
  setupRpcSignalListener,
  type OdooRpcSignal,
} from '../rpcInterceptor';
import { chromeMock } from '../../test/chromeMock';

const signal: OdooRpcSignal = {
  source: 'odoo-rpc-interceptor',
  payload: {
    model: 'crm.lead',
    method: 'unlink',
    args: [[1]],
    result: true,
    url: '/web/dataset/call_kw/crm.lead/unlink',
    ts: 1,
  },
};

describe('isOdooRpcSignal', () => {
  it('accepts only messages from the interceptor with a payload', () => {
    expect(isOdooRpcSignal(signal)).toBe(true);
    expect(isOdooRpcSignal({ source: 'other', payload: {} })).toBe(false);
    expect(isOdooRpcSignal({ source: 'odoo-rpc-interceptor', payload: null })).toBe(false);
    expect(isOdooRpcSignal('odoo-rpc-interceptor')).toBe(false);
  });
});

describe('isRelevantModel', () => {
  it('knows the four synced models', () => {
    expect(isRelevantModel('mail.activity.schedule')).toBe(true);
    expect(isRelevantModel('account.move')).toBe(false);
  });
});

describe('setupRpcSignalListener', () => {
  it('passes same-window signals through and ignores everything else', () => {
    const callback = vi.fn();
    const cleanup = setupRpcSignalListener(callback);

    window.dispatchEvent(new MessageEvent('message', { data: signal, source: window }));
    window.dispatchEvent(new MessageEvent('message', { data: { hello: 'world' }, source: window }));
    window.dispatchEvent(new MessageEvent('message', { data: signal, source: null }));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(signal);

    cleanup();
    window.dispatchEvent(new MessageEvent('message', { data: signal, source: window }));
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('injectRpcInterceptor', () => {
  it('adds the packaged interceptor script to the page', () => {
    injectRpcInterceptor();
    const script = document.head.querySelector('script');
    expect(script?.src).toBe('chrome-extension://test-extension-id/rpc-interceptor.js');
    expect(chromeMock().runtime.getURL).toHaveBeenCalledWith('rpc-interceptor.js');
    script?.remove();
  });
});
