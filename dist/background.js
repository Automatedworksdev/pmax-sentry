// PMax Sentry Background v2.1 - Working Version
// Uses Supabase REST API directly

const SUPABASE_URL = 'https://mlgtlirrhlftjgfdsajy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k';

// Embedded test data for fallback
const EMBEDDED_CHANNELS = [
  'kids tv', 'gaming channel', 'music videos', 'asmr sounds', 'news 24/7',
  'cartoon network', 'mobile games', 'pop music', 'sleep asmr', 'breaking news',
  'cocomelon', 'kids tv channel', 'gaming hub', 'gaming hub live'
];

const EMBEDDED_KEYWORDS = ['kids', 'gaming', 'music', 'asmr', 'news', 'cartoon', 'mobile', 'pop', 'sleep', 'breaking'];

// State
let licenseStatus = { valid: false, key: null };

// Initialize
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Validate license
async function validateLicense(key) {
  try {
    // Check if license exists in database
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${encodeURIComponent(key)}&select=*`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('License check failed:', error);
      return { valid: false, error: 'Database error' };
    }
    
    const licenses = await response.json();
    
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
    
    // Increment use count
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
          use_count: license.use_count + 1,
          last_used_at: new Date().toISOString()
        })
      }
    );
    
    // Save to storage with embedded data
    await chrome.storage.local.set({
      licenseKey: key,
      licensed: true,
      licenseInfo: {
        ...license,
        use_count: license.use_count + 1
      },
      // Store channel data for content script
      channelSet: EMBEDDED_CHANNELS,
      suspectedKeywords: EMBEDDED_KEYWORDS
    });
    
    licenseStatus = { valid: true, key: key };
    
    return {
      valid: true,
      uses: license.use_count + 1,
      maxUses: license.max_uses
    };
    
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Network error: ' + error.message };
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received:', request.action);
  
  if (request.action === 'validateLicense') {
    validateLicense(request.key).then(result => {
      console.log('Validation result:', result);
      sendResponse(result);
    }).catch(err => {
      console.error('Validation error:', err);
      sendResponse({ valid: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'getLicenseStatus') {
    chrome.storage.local.get(['licensed', 'licenseInfo']).then(data => {
      console.log('License status:', data);
      sendResponse({
        valid: !!data.licensed,
        uses: data.licenseInfo?.use_count,
        maxUses: data.licenseInfo?.max_uses
      });
    });
    return true;
  }
  
  if (request.action === 'contentScriptReady') {
    console.log('Content script reported ready');
    sendResponse({ acknowledged: true });
    return true;
  }
  
  sendResponse({ error: 'Unknown action' });
  return true;
});