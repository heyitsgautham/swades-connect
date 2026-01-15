// Service Worker - will handle message routing and storage operations
console.log('Swades Connect Service Worker loaded');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Message received in service worker:', message);
  sendResponse({ status: 'acknowledged' });
  return true; // Required for async response
});
