// PMax Sentry Background v2.1 - Licensed Edition
// Requires valid license key from Supabase

const SUPABASE_URL = 'https://your-project.supabase.co';
const VALIDATE_ENDPOINT = `${SUPABASE_URL}/functions/v1/validate-license`;

// State
let licenseStatus = {
  valid: false,
  key: null,
  data: null,
  lastValidated: null
};

let dataCache = {
  channelSet: new Set(),
  suspectedKeywords: new Set(),
  loaded: false
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('PMax Sentry: Checking license...');
  initializeLicense();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Check stored license on startup
async function initializeLicense() {
  const result = await chrome.storage.local.get(['licenseKey', 'licenseData']);
  
  if (result.licenseKey && result.licenseData) {
    // Verify cached data isn't expired (24 hours)
    const age = Date.now() - (result.licenseData.timestamp || 0);
    if (age < 24 * 60 * 60 * 1000) {
      // Use cached data
      licenseStatus = {
        valid: true,
        key: result.licenseKey,
        data: result.licenseData,
        lastValidated: result.licenseData.timestamp
      };
      await loadChannelData(result.licenseData.data);
      console.log('PMax Sentry: License validated from cache');
      return;
    }
  }
  
  // No valid license - require activation
  licenseStatus.valid = false;
  console.log('PMax Sentry: License required');
}

// Validate license with Supabase
async function validateLicense(key) {
  try {
    const response = await fetch(VALIDATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, version: '2.0.0' })
    });
    
    if (response.status === 403) {
      return { valid: false, error: 'Invalid or exhausted license' };
    }
    
    if (!response.ok) {
      return { valid: false, error: 'Validation service unavailable' };
    }
    
    const result = await response.json();
    
    if (result.valid) {
      // Cache the data
      const cacheData = {
        ...result.data,
        timestamp: Date.now(),
        licenseInfo: result.license
      };
      
      await chrome.storage.local.set({
        licenseKey: key,
        licenseData: cacheData
      });
      
      licenseStatus = {
        valid: true,
        key: key,
        data: cacheData,
        lastValidated: Date.now()
      };
      
      await loadChannelData(result.data);
      
      return { valid: true, uses: result.license.uses, maxUses: result.license.maxUses };
    }
    
    return { valid: false, error: 'Unknown validation error' };
    
  } catch (error) {
    console.error('License validation error:', error);
    return { valid: false, error: 'Network error' };
  }
}

// Load channel data into optimized Sets
async function loadChannelData(data) {
  if (!data || !data.channels) {
    console.error('Invalid channel data');
    return;
  }
  
  const channelSet = new Set();
  const typeMap = new Map();
  
  for (const channel of data.channels) {
    const normalized = channel.name.toLowerCase().trim();
    channelSet.add(normalized);
    typeMap.set(normalized, channel.type);
  }
  
  const keywordSet = new Set(
    (data.suspectedKeywords || []).map(k => k.toLowerCase().trim())
  );
  
  dataCache = {
    channelSet,
    channelTypeMap: typeMap,
    suspectedKeywords: keywordSet,
    loaded: true
  };
  
  // Persist to storage for content script access
  await chrome.storage.local.set({
    channelSet: Array.from(channelSet),
    channelTypeMap: Array.from(typeMap.entries()),
    suspectedKeywords: Array.from(keywordSet),
    licenseValidated: true
  });
  
  console.log(`Loaded ${channelSet.size} channels, ${keywordSet.size} keywords`);
}

// Check if licensed
function isLicensed() {
  return licenseStatus.valid && dataCache.loaded;
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'getLicenseStatus') {
    sendResponse({
      valid: licenseStatus.valid,
      key: licenseStatus.key,
      lastValidated: licenseStatus.lastValidated,
      uses: licenseStatus.data?.licenseInfo?.uses,
      maxUses: licenseStatus.data?.licenseInfo?.maxUses
    });
    return true;
  }
  
  if (request.action === 'validateLicense') {
    validateLicense(request.key).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'clearLicense') {
    chrome.storage.local.remove(['licenseKey', 'licenseData', 'licenseValidated']);
    licenseStatus = { valid: false, key: null, data: null, lastValidated: null };
    dataCache = { channelSet: new Set(), suspectedKeywords: new Set(), loaded: false };
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'checkChannel') {
    if (!isLicensed()) {
      sendResponse({ error: 'License required', tier: 'unlicensed' });
      return true;
    }
    
    const normalized = request.channel?.toLowerCase().trim() || '';
    
    // Tier 1: O(1) exact match
    if (dataCache.channelSet.has(normalized)) {
      sendResponse({
        tier: 'tier1',
        type: dataCache.channelTypeMap.get(normalized),
        keyword: null
      });
      return true;
    }
    
    // Tier 2: Keyword match
    for (const keyword of dataCache.suspectedKeywords) {
      if (normalized.includes(keyword)) {
        sendResponse({
          tier: 'tier2',
          type: 'Suspected',
          keyword: keyword
        });
        return true;
      }
    }
    
    sendResponse({ tier: 'none', type: null, keyword: null });
    return true;
  }
  
  if (request.action === 'getChannelStats') {
    if (!isLicensed()) {
      sendResponse({ error: 'License required' });
      return true;
    }
    
    sendResponse({
      totalChannels: dataCache.channelSet?.size || 0,
      suspectedKeywords: dataCache.suspectedKeywords?.size || 0,
      licensed: true
    });
    return true;
  }
});