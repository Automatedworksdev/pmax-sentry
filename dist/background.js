// PMax Sentry Background v2.1 - Licensed Edition
// Uses Supabase REST API with SERVICE ROLE KEY
// NOTE: In production, use Edge Function instead

const SUPABASE_URL = 'https://mlgtlirrhlftjgfdsajy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k';

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
    const age = Date.now() - (result.licenseData.timestamp || 0);
    if (age < 24 * 60 * 60 * 1000) {
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
  
  licenseStatus.valid = false;
  console.log('PMax Sentry: License required');
}

// Validate license with Supabase REST API
async function validateLicense(key) {
  try {
    // Check license
    const licenseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${encodeURIComponent(key)}`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    
    if (!licenseResponse.ok) {
      const errorText = await licenseResponse.text();
      console.error('License check failed:', errorText);
      return { valid: false, error: 'Database error' };
    }
    
    const licenses = await licenseResponse.json();
    
    if (!licenses || licenses.length === 0) {
      return { valid: false, error: 'Invalid license key' };
    }
    
    const license = licenses[0];
    
    if (license.status !== 'active') {
      return { valid: false, error: 'License revoked' };
    }
    
    if (license.use_count >= license.max_uses) {
      return { valid: false, error: 'License exhausted' };
    }
    
    // Get junk data
    const dataResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/master_junk_list?version=eq.2.0.0`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    
    if (!dataResponse.ok) {
      return { valid: false, error: 'Data unavailable' };
    }
    
    const dataResults = await dataResponse.json();
    
    if (!dataResults || dataResults.length === 0) {
      return { valid: false, error: 'No data found' };
    }
    
    const junkData = dataResults[0].data;
    
    // Update use count
    const newUseCount = license.use_count + 1;
    await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?id=eq.${license.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          use_count: newUseCount,
          last_used_at: new Date().toISOString()
        })
      }
    );
    
    // Cache data
    const cacheData = {
      ...junkData,
      timestamp: Date.now(),
      licenseInfo: {
        ...license,
        use_count: newUseCount
      }
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
    
    await loadChannelData(junkData);
    
    return { 
      valid: true, 
      uses: newUseCount, 
      maxUses: license.max_uses 
    };
    
  } catch (error) {
    console.error('License validation error:', error);
    return { valid: false, error: 'Network error: ' + error.message };
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
    
    if (dataCache.channelSet.has(normalized)) {
      sendResponse({
        tier: 'tier1',
        type: dataCache.channelTypeMap.get(normalized),
        keyword: null
      });
      return true;
    }
    
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