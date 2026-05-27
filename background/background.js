/**
 * background/background.js
 * Service Worker for Spam & Phishing Detector (Manifest V3)
 * Handles extension lifecycle events and context menu actions
 */

// Initialize default settings on install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      backendUrl: 'http://127.0.0.1:8000',
      dashboardUrl: 'http://localhost:3000',
    });
    console.log('[SpamDetector] Extension installed. Default settings applied.');
  }

  if (details.reason === 'update') {
    console.log(`[SpamDetector] Extension updated to v${chrome.runtime.getManifest().version}`);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.storage.sync.get({ dashboardUrl: 'http://localhost:3000' }, (data) => {
      chrome.tabs.create({ url: data.dashboardUrl });
      sendResponse({ success: true });
    });
    return true; // async response
  }

  if (message.type === 'GET_ACTIVE_TAB_URL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      sendResponse({ url });
    });
    return true;
  }
});
