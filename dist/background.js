// PMax Sentry Background v2.2 - Intelligence Engine
// Auto-syncs data on login, ensures cache is always available

const SUPABASE_URL = 'https://mlgtlirrhlftjgfdsajy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZ3RsaXJyaGxmdGpnZmRzYWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzUxMSwiZXhwIjoyMDkyOTIzNTExfQ.yxGJs_XPV6PqVxfsp65G56A0TZrYW0QkxmgdvI8765k';

const DATA_VERSION = '2.2';
const CACHE_KEY = 'pmaxData';
const VERSION_KEY = 'pmaxDataVersion';

// 50 high-intent junk keywords
const JUNK_KEYWORDS = [
  'kids', 'children', 'toddler', 'baby', 'nursery', 'cartoon', 'cocomelon', 
  'peppa', 'paw patrol', 'disney junior', 'nick jr', 'baby shark',
  'gaming', 'gameplay', 'lets play', 'gamer', 'esports', 'twitch', 'streamer',
  'mobile reward', 'app reward', 'offer wall', 'get paid', 'earn money', 'cash app',
  'asmr', 'sleep sounds', 'relaxation', 'meditation', 'white noise', 'rain sounds',
  'breaking news', 'live news', '24/7 news', 'news live',
  'music playlist', 'lyrics video', 'top hits', 'pop songs', 'music video',
  'compilation', 'best of', 'top 10', 'funny videos', 'viral',
  'clickbait', 'prank', 'challenge', 'reaction video', 'meme'
];

// Embedded fallback data (always available)
const EMBEDDED_CHANNELS = [
  'cocomelon', 'kids tv', 'cartoon network', 'baby shark', 'peppa pig', 'paw patrol',
  'gaming hub', 'mobile games', 'gameplay', 'lets play', 'esports', 'gamer',
  'asmr', 'sleep sounds', 'relaxation', 'meditation', 'white noise',
  'breaking news', 'live news', '24/7 news', 'news channel',
  'mobile reward', 'app reward', 'earn money', 'cash app',
  'music playlist', 'pop songs', 'lyrics video'
];

const EMBEDDED_CATEGORIES = {
  'Kids': ['cocomelon', 'kids tv', 'cartoon network', 'baby shark', 'peppa pig', 'paw patrol'],
  'Gaming': ['gaming hub', 'mobile games', 'gameplay', 'lets play', 'esports', 'gamer'],
  'ASMR': ['asmr', 'sleep sounds', 'relaxation', 'meditation', 'white noise'],
  'News': ['breaking news', 'live news', '24/7 news', 'news channel'],
  'MFA': ['mobile reward', 'app reward', 'earn money', 'cash app'],
  'Music': ['music playlist', 'pop songs', 'lyrics video']
};

// Initialize
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Validate license and ALWAYS sync data immediately
async function validateLicense(key) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${encodeURIComponent(key)}&select=*`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      return { valid: false, error: 'Database error' };
    }
    
    const licenses = await response.json();
    if (!licenses?.length) {
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
    await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${license.id}`, {
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
    });
    
    // CRITICAL: Sync channel data IMMEDIATELY before returning success
    console.log('[PMax] License valid, syncing data...');
    const syncResult = await syncChannelData();
    
    // Save license info
    await chrome.storage.local.set({
      licenseKey: key,
      licensed: true,
      licenseInfo: { ...license, use_count: license.use_count + 1 }
    });
    
    console.log('[PMax] License activated, data synced:', syncResult);
    
    return { 
      valid: true, 
      uses: license.use_count + 1, 
      maxUses: license.max_uses,
      synced: syncResult
    };
    
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Network error: ' + error.message };
  }
}

// Sync channel data - returns true if successful
async function syncChannelData(force = false) {
  try {
    // Check if we need to sync
    if (!force) {
      const cached = await chrome.storage.local.get([VERSION_KEY, CACHE_KEY]);
      if (cached[VERSION_KEY] === DATA_VERSION && cached[CACHE_KEY]?.channels?.length > 0) {
        console.log('[PMax] Using cached data');
        return { success: true, source: 'cache', channels: cached[CACHE_KEY].channels.length };
      }
    }
    
    console.log('[PMax] Fetching fresh data from Supabase (all rows)...');
    
    // Fetch ALL rows from Supabase (using Range header for up to 10,000 rows)
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/master_junk_list?select=channel_name,category&status=eq.active`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Range': '0-59999'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const channels = await response.json();
    
    console.log(`[PMax] Fetched ${channels.length} channels from Supabase`);
    
    if (!channels || channels.length === 0) {
      throw new Error('No channels returned');
    }
    
    console.log(`[PMax] Total channels to process: ${channels.length}`);
    
    // Build data structure
    const data = {
      channels: channels.map(c => c.channel_name.toLowerCase()),
      categories: {},
      version: DATA_VERSION,
      syncedAt: Date.now()
    };
    
    // Group by category
    channels.forEach(c => {
      const cat = c.category || 'General';
      if (!data.categories[cat]) data.categories[cat] = [];
      data.categories[cat].push(c.channel_name.toLowerCase());
    });
    
    // Save to storage
    await chrome.storage.local.set({
      [VERSION_KEY]: DATA_VERSION,
      [CACHE_KEY]: data,
      suspectedKeywords: JUNK_KEYWORDS
    });
    
    console.log(`[PMax] Synced ${channels.length} channels from Supabase`);
    return { success: true, source: 'supabase', channels: channels.length };
    
  } catch (error) {
    console.error('[PMax] Sync error:', error);
    
    // Fallback to embedded data
    const fallbackData = {
      channels: EMBEDDED_CHANNELS,
      categories: EMBEDDED_CATEGORIES,
      version: DATA_VERSION,
      syncedAt: Date.now()
    };
    
    await chrome.storage.local.set({
      [VERSION_KEY]: DATA_VERSION,
      [CACHE_KEY]: fallbackData,
      suspectedKeywords: JUNK_KEYWORDS
    });
    
    console.log('[PMax] Using fallback data with', fallbackData.channels.length, 'channels');
    return { success: true, source: 'fallback', channels: fallbackData.channels.length };
  }
}

// Community report submission
async function submitCommunityReport(data) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/community_suggestions`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        channel_name: data.channelName,
        channel_url: data.channelUrl,
        category: data.category,
        reason: data.reason
      })
    });
    
    return { success: response.ok };
    
  } catch (error) {
    console.error('[PMax] Report error:', error);
    return { success: false, error: error.message };
  }
}

// Force data refresh
async function forceRefresh() {
  await chrome.storage.local.remove([VERSION_KEY, CACHE_KEY]);
  const result = await syncChannelData(true);
  return result;
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'validateLicense') {
    validateLicense(request.key).then(sendResponse);
    return true;
  }
  
  if (request.action === 'getLicenseStatus') {
    chrome.storage.local.get(['licensed', 'licenseInfo']).then(data => {
      sendResponse({
        valid: !!data.licensed,
        uses: data.licenseInfo?.use_count,
        maxUses: data.licenseInfo?.max_uses
      });
    });
    return true;
  }
  
  if (request.action === 'submitReport') {
    submitCommunityReport(request.data).then(sendResponse);
    return true;
  }
  
  if (request.action === 'forceRefresh') {
    forceRefresh().then(sendResponse);
    return true;
  }
  
  if (request.action === 'getStats') {
    chrome.storage.local.get([CACHE_KEY, 'licenseInfo']).then(data => {
      const cached = data[CACHE_KEY] || {};
      sendResponse({
        channelCount: cached.channels?.length || 0,
        categories: cached.categories || {},
        version: cached.version,
        syncedAt: cached.syncedAt,
        uses: data.licenseInfo?.use_count,
        maxUses: data.licenseInfo?.max_uses
      });
    });
    return true;
  }
  
  if (request.action === 'syncData') {
    syncChannelData(request.force).then(sendResponse);
    return true;
  }
  
  return true;
});