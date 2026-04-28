// PMax Sentry Background v2.1 - Embedded Data Edition
// No network required - data is embedded

const EMBEDDED_DATA = {
  version: '2.0.0',
  totalChannels: 10,
  channels: [
    { name: 'Kids TV', type: 'Kids' },
    { name: 'Gaming Channel', type: 'Gaming' },
    { name: 'Music Videos', type: 'Music' },
    { name: 'ASMR Sounds', type: 'ASMR' },
    { name: 'News 24/7', type: 'News' },
    { name: 'Cartoon Network', type: 'Kids' },
    { name: 'Mobile Games', type: 'Gaming' },
    { name: 'Pop Music', type: 'Music' },
    { name: 'Sleep ASMR', type: 'ASMR' },
    { name: 'Breaking News', type: 'News' }
  ],
  suspectedKeywords: ['kids','gaming','music','asmr','news','cartoon','mobile','pop','sleep','breaking']
};

let licenseStatus = { valid: false, key: null, uses: 0, maxUses: 10 };

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function validateLicense(key) {
  console.log('Validating:', key);
  
  // Simple validation: must start with PMX- and be 16 chars
  if (key && key.startsWith('PMX-') && key.length === 16) {
    await chrome.storage.local.set({ licenseKey: key, validated: true, activatedAt: Date.now() });
    licenseStatus = { valid: true, key: key, uses: 1, maxUses: 10 };
    
    // Load embedded data
    const channelSet = new Set();
    const typeMap = new Map();
    EMBEDDED_DATA.channels.forEach(c => {
      const normalized = c.name.toLowerCase().trim();
      channelSet.add(normalized);
      typeMap.set(normalized, c.type);
    });
    
    await chrome.storage.local.set({
      channelSet: Array.from(channelSet),
      channelTypeMap: Array.from(typeMap.entries()),
      suspectedKeywords: EMBEDDED_DATA.suspectedKeywords,
      totalChannels: EMBEDDED_DATA.totalChannels
    });
    
    console.log('License activated:', key);
    return { valid: true, uses: 1, maxUses: 10 };
  }
  
  console.log('Invalid format');
  return { valid: false, error: 'Invalid format. Use PMX-XXXX-XXXX-XXXX' };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message:', request.action);
  
  if (request.action === 'validateLicense') {
    validateLicense(request.key).then(result => sendResponse(result));
    return true;
  }
  
  if (request.action === 'getLicenseStatus') {
    sendResponse(licenseStatus);
    return true;
  }
  
  if (request.action === 'clearLicense') {
    chrome.storage.local.remove(['licenseKey', 'validated']);
    licenseStatus = { valid: false, key: null, uses: 0, maxUses: 10 };
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'checkChannel') {
    chrome.storage.local.get(['channelSet','channelTypeMap','suspectedKeywords','validated']).then(data => {
      if (!data.validated) {
        sendResponse({ error: 'License required', tier: 'unlicensed' });
        return;
      }
      
      const normalized = (request.channel || '').toLowerCase().trim();
      const channelSet = new Set(data.channelSet || []);
      const typeMap = new Map(data.channelTypeMap || []);
      
      if (channelSet.has(normalized)) {
        sendResponse({ tier: 'tier1', type: typeMap.get(normalized), keyword: null });
        return;
      }
      
      for (const kw of (data.suspectedKeywords || [])) {
        if (normalized.includes(kw)) {
          sendResponse({ tier: 'tier2', type: 'Suspected', keyword: kw });
          return;
        }
      }
      
      sendResponse({ tier: 'none', type: null, keyword: null });
    });
    return true;
  }
  
  if (request.action === 'getChannelStats') {
    chrome.storage.local.get(['totalChannels','validated']).then(data => {
      sendResponse({ 
        totalChannels: data.totalChannels || 10, 
        licensed: !!data.validated 
      });
    });
    return true;
  }
});