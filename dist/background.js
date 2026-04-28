// PMax Sentry v2.2 - Simple Working Version
// No external dependencies

console.log('PMax Sentry: Background script loaded');

const TEST_DATA = {
  channels: [
    {name: 'Kids Channel', type: 'Kids'},
    {name: 'Gaming Hub', type: 'Gaming'},
    {name: 'Music TV', type: 'Music'}
  ],
  keywords: ['kids', 'gaming', 'music']
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'ping') {
    sendResponse({pong: true});
    return true;
  }
  
  if (request.action === 'validateLicense') {
    const key = request.key || '';
    console.log('Validating key:', key);
    
    if (key.startsWith('PMX-')) {
      // Save to storage
      chrome.storage.local.set({
        license: key,
        licensed: true
      });
      
      sendResponse({
        valid: true,
        message: 'License activated!'
      });
    } else {
      sendResponse({
        valid: false,
        error: 'Key must start with PMX-'
      });
    }
    return true;
  }
  
  if (request.action === 'getLicenseStatus') {
    chrome.storage.local.get(['licensed'], (data) => {
      sendResponse({
        valid: !!data.licensed
      });
    });
    return true;
  }
  
  sendResponse({error: 'Unknown action'});
  return true;
});

console.log('PMax Sentry: Ready');