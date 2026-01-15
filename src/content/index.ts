// Content Script - will extract data from Odoo pages
console.log('Swades Connect Content Script loaded on:', window.location.href);

// Test message to service worker
chrome.runtime.sendMessage(
  { action: 'TEST', data: 'Content script active' },
  (response) => {
    console.log('Response from service worker:', response);
  }
);
