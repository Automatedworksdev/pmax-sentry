// PMax Sentry Background v2.2 - Intelligence Engine
// Optimized: Fast license validation + background sync

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

// Validate license - FAST: only validates, sync happens in background
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
    
    // Save license info immediately (fast)
    await chrome.storage.local.set({
      licenseKey: key,
      licensed: true,
      licenseInfo: { ...license, use_count: license.use_count + 1 },
      syncStatus: 'pending'
    });
    
    // START BACKGROUND SYNC (don't wait for it)
    console.log('[PMax] License valid, starting background sync...');
    syncChannelDataInBackground();
    
    return { 
      valid: true, 
      uses: license.use_count + 1, 
      maxUses: license.max_uses,
      syncStatus: 'background'
    };
    
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Network error: ' + error.message };
  }
}

// Background sync function
async function syncChannelDataInBackground() {
  try {
    console.log('[PMax] Background sync started...');
    await chrome.storage.local.set({ syncStatus: 'in_progress', syncProgress: 0 });
    
    const result = await syncChannelData(true);
    
    await chrome.storage.local.set({ 
      syncStatus: 'completed', 
      syncProgress: 100,
      lastSyncAt: Date.now()
    });
    
    console.log('[PMax] Background sync completed:', result);
    
    // Notify sidepanel if open
    try {
      chrome.runtime.sendMessage({ 
        action: 'syncComplete', 
        channels: result.channels 
      });
    } catch (e) {
      // Sidepanel might not be open, ignore
    }
    
  } catch (error) {
    console.error('[PMax] Background sync failed:', error);
    await chrome.storage.local.set({ 
      syncStatus: 'failed', 
      syncError: error.message 
    });
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
    
    // Fetch ALL rows using Range pagination
    let allChannels = [];
    let offset = 0;
    const limit = 1000;
    const maxRows = 60000;
    
    while (offset < maxRows) {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/master_junk_list?select=channel_name,category&status=eq.active&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const channels = await response.json();
      
      if (channels.length === 0) {
        break;
      }
      
      allChannels = allChannels.concat(channels);
      offset += limit;
      
      // Update progress
      const progress = Math.min(Math.round((allChannels.length / 52000) * 100), 99);
      await chrome.storage.local.set({ syncProgress: progress });
      
      console.log(`[PMax] Fetched ${allChannels.length} channels so far...`);
    }
    
    const channels = allChannels;
    console.log(`[PMax] Final total: ${channels.length} channels`);
    
    if (!channels || channels.length === 0) {
      throw new Error('No channels returned');
    }
    
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
      suspectedKeywords: JUNK_KEYWORDS,
      syncStatus: 'completed',
      syncProgress: 100
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
      suspectedKeywords: JUNK_KEYWORDS,
      syncStatus: 'fallback',
      syncError: error.message
    });
    
    return { success: true, source: 'fallback', channels: EMBEDDED_CHANNELS.length };
  }
}

// Force data refresh
async function forceRefresh() {
  await chrome.storage.local.remove([VERSION_KEY, CACHE_KEY]);
  return await syncChannelData(true);
}

// Get stats for display
async function getStats() {
  const data = await chrome.storage.local.get([CACHE_KEY, VERSION_KEY]);
  const cache = data[CACHE_KEY];
  
  if (!cache) {
    return { channelCount: 0, version: DATA_VERSION, syncedAt: null };
  }
  
  return {
    channelCount: cache.channels?.length || 0,
    version: cache.version || DATA_VERSION,
    syncedAt: cache.syncedAt
  };
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'validateLicense') {
    validateLicense(request.key).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ valid: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'getLicenseStatus') {
    chrome.storage.local.get(['licensed', 'licenseKey', 'licenseInfo']).then(data => {
      sendResponse({ 
        valid: data.licensed === true,
        key: data.licenseKey,
        info: data.licenseInfo
      });
    }).catch(err => {
      sendResponse({ valid: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'forceRefresh') {
    forceRefresh().then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'getStats') {
    getStats().then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ channelCount: 0, version: DATA_VERSION, syncedAt: null, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'getSyncStatus') {
    chrome.storage.local.get(['syncStatus', 'syncProgress', 'lastSyncAt']).then(data => {
      sendResponse(data);
    }).catch(err => {
      sendResponse({ syncStatus: 'error', error: err.message });
    });
    return true;
  }
  
  if (request.action === 'scanComplete') {
    // Forward scan results to sidepanel
    chrome.runtime.sendMessage({
      action: 'scanResults',
      data: request.data
    }).catch(() => {
      // Sidepanel might not be open, ignore
    });
    sendResponse({ received: true });
    return false; // Synchronous response
  }
  
  // Unknown action - send empty response
  sendResponse({ error: 'Unknown action' });
  return false;
});

// Handle connection errors gracefully
chrome.runtime.onConnect.addListener((port) => {
  console.log('[PMax] Port connected:', port.name);
  
  port.onDisconnect.addListener(() => {
    if (chrome.runtime.lastError) {
      console.log('[PMax] Port disconnected:', chrome.runtime.lastError.message);
    }
  });
});

// Auto-sync on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('[PMax] Extension installed/updated');
});

console.log('[PMax Sentry] Background script loaded v2.2');