chrome.runtime.onInstalled.addListener((details) => {
  // Load junk channels into storage on install
  fetch(chrome.runtime.getURL('junk_channels.json'))
    .then(response => response.json())
    .then(data => {
      chrome.storage.local.set({ junkList: data }, () => {
        console.log('PMax Sentry: Junk channels loaded into storage');
      });
    })
    .catch(error => {
      console.error('PMax Sentry: Failed to load junk channels:', error);
    });
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJunkList') {
    chrome.storage.local.get('junkList', (result) => {
      sendResponse({ junkList: result.junkList || [] });
    });
    return true;
  }
  
  if (request.action === 'updateWastedSpend') {
    chrome.storage.local.set({ wastedSpend: request.amount }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});