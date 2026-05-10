/**
 * PMax Sentry Background Script v3.0 - Proxy Architecture
 * 
 * Changes in v3.0:
 * - All Supabase calls removed
 * - All database queries go through proxy server
 * - License validation via proxy
 * - Batch processing for channel classification
 * - No local channel database (removed chrome.storage.local for channel data)
 */

const PROXY_URL = 'https://pmax-sentry-proxy-git-master-automatedworksdevs-projects.vercel.app';
const DATA_VERSION = '3.0';

// Junk keywords for Tier 2 classification (fallback only)
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

// Initialize - fetch stats from proxy on startup
chrome.runtime.onStartup.addListener(() => {
  fetchStatsFromProxy();
});

chrome.runtime.onInstalled.addListener(() => {
  fetchStatsFromProxy();
});

// Fetch stats from proxy
async function fetchStatsFromProxy() {
  try {
    const response = await fetch(`${PROXY_URL}/api/stats`);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    
    await chrome.storage.local.set({
      channelCount: data.total,
      dataVersion: DATA_VERSION,
      lastSyncAt: Date.now()
    });
    console.log('[Background] Fetched stats from proxy:', data.total);
  } catch (err) {
    console.error('[Background] Failed to fetch stats:', err.message);
  }
}

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

/**
 * Validate license via proxy server
 */
async function validateLicense(key) {
  try {
    const response = await fetch(`${PROXY_URL}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      return { valid: false, error: error.error || 'Server error' };
    }
    
    const result = await response.json();
    
    if (result.valid) {
      // Save license info
      await chrome.storage.local.set({
        licenseKey: key,
        licensed: true,
        licenseInfo: {
          maxUses: result.maxUses,
          currentUses: result.currentUses,
          tier: result.tier,
          expiresAt: result.expiresAt
        }
      });
      
      return { 
        valid: true, 
        uses: result.currentUses, 
        maxUses: result.maxUses,
        tier: result.tier
      };
    }
    
    return { valid: false, error: result.error || 'Invalid license' };
    
  } catch (error) {
    console.error('[PMax] License validation error:', error);
    return { valid: false, error: 'Network error: ' + error.message };
  }
}

/**
 * Classify channels via proxy (bulk request)
 */
async function classifyChannels(channels, licenseKey) {
  try {
    const response = await fetch(`${PROXY_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels, licenseKey })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      return { error: error.error || 'Classification failed' };
    }
    
    const result = await response.json();
    
    // FINAL LOGIC: Database = Tier 1 (Confirmed), Keywords = Tier 2 (Suspected)
    if (result.results) {
      result.results = result.results.map(r => {
        // Normalize category first
        if (r.category === 'General' || r.category === 'UNKNOWN') {
          r.category = 'Low Quality';
        }
        
        // If proxy returned a real category (not Low Quality), it's from database = Tier 1
        const hasRealCategory = r.category && r.category !== 'Low Quality';
        
        if (hasRealCategory) {
          // Database match = Tier 1 (Confirmed)
          r.tier = 'tier1';
          r.source = 'database';
        } else {
          // No database match - check keywords for Tier 2
          const normalized = r.name?.toLowerCase() || '';
          const match = checkSuspectedKeywords(normalized);
          if (match) {
            r.category = match.category;
            r.tier = 'tier2';
            r.source = 'keyword';
          } else {
            r.category = 'Low Quality';
            r.tier = 'none';
          }
        }
        return r;
      });
    }
    
    // Cache the results temporarily for this session
    await chrome.storage.session.set({
      lastClassification: {
        results: result.results,
        timestamp: Date.now()
      }
    });
    
    return result;
    
  } catch (error) {
    console.error('[PMax] Classification error:', error);
    
    // Fallback: classify locally using keywords only
    const fallbackResults = channels.map(channel => {
      const normalized = channel.name?.toLowerCase() || '';
      const tier2Match = checkSuspectedKeywords(normalized);
      
      if (tier2Match) {
        return {
          name: channel.name,
          url: channel.url,
          tier: 'tier2',
          category: tier2Match.category,
          keyword: tier2Match.keyword,
          placementId: channel.url || channel.name
        };
      }
      
      return {
        name: channel.name,
        url: channel.url,
        tier: 'none',
        placementId: channel.url || channel.name
      };
    });
    
    return { results: fallbackResults, fallback: true };
  }
}

function checkSuspectedKeywords(channelName) {
  const normalized = channelName.toLowerCase();
  const keywords = [
    { keyword: 'kids', category: 'Kids' },
    { keyword: 'children', category: 'Kids' },
    { keyword: 'toddler', category: 'Kids' },
    { keyword: 'baby', category: 'Kids' },
    { keyword: 'nursery', category: 'Kids' },
    { keyword: 'cartoon', category: 'Kids' },
    { keyword: 'cocomelon', category: 'Kids' },
    { keyword: 'gaming', category: 'Gaming' },
    { keyword: 'gameplay', category: 'Gaming' },
    { keyword: 'mobile reward', category: 'MFA' },
    { keyword: 'earn money', category: 'MFA' },
    { keyword: 'asmr', category: 'ASMR' },
    { keyword: 'sleep sounds', category: 'ASMR' },
    { keyword: 'breaking news', category: 'News' },
    { keyword: 'live news', category: 'News' },
    { keyword: 'music playlist', category: 'Music' },
  ];
  
  for (const item of keywords) {
    if (normalized.includes(item.keyword.toLowerCase())) {
      return item;
    }
  }
  return null;
}

/**
 * Sync channel data via proxy (for paid users)
 */
async function syncChannelData(force = false) {
  try {
    await fetchStatsFromProxy();
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Report channel via proxy
 */
async function reportChannel(channel, category, tier, licenseKey) {
  try {
    const response = await fetch(`${PROXY_URL}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, channel, category, tier })
    });
    
    if (!response.ok) {
      return { success: false };
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[PMax] Report error:', error);
    return { success: false };
  }
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
  
  if (request.action === 'classifyChannels') {
    classifyChannels(request.channels, request.licenseKey).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
  
  if (request.action === 'forceRefresh' || request.action === 'syncData') {
    syncChannelData(true).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }
  
  if (request.action === 'getStats') {
    chrome.storage.local.get(['lastSyncAt', 'dataVersion', 'channelCount', 'isTrial']).then(data => {
      sendResponse({
        channelCount: data.channelCount || 0,
        version: data.dataVersion || DATA_VERSION,
        syncedAt: data.lastSyncAt,
        isTrial: data.isTrial || false
      });
    }).catch(err => {
      sendResponse({ channelCount: 0, version: DATA_VERSION, syncedAt: null });
    });
    return true;
  }
  
  if (request.action === 'getSyncStatus') {
    chrome.storage.local.get(['syncStatus', 'lastSyncAt']).then(data => {
      sendResponse({
        syncStatus: data.syncStatus || 'unknown',
        lastSyncAt: data.lastSyncAt
      });
    }).catch(err => {
      sendResponse({ syncStatus: 'error', error: err.message });
    });
    return true;
  }
  
  if (request.action === 'reportChannel') {
    reportChannel(request.channel, request.category, request.tier, request.licenseKey).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (request.action === 'scanComplete') {
    chrome.runtime.sendMessage({
      action: 'scanResults',
      data: request.data
    }).catch(() => {});
    sendResponse({ received: true });
    return false;
  }
  
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
  console.log('[PMax Sentry] Extension installed/updated v3.0');
});

console.log('[PMax Sentry] Background script loaded v3.0 (Proxy Architecture)');