// PMax Sentry - Background Service Worker v2.0
// Optimized with categorized Set-based storage for 2000+ channels

// In-memory caches
let channelSet = new Set();
let channelTypeMap = new Map();
let suspectedKeywords = new Set();
let dataLoaded = false;

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('PMax Sentry v2.0: Loading production master list...');
  loadAndOptimizeChannels();
});

// Open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Load and optimize channel data
async function loadAndOptimizeChannels() {
  try {
    const response = await fetch(chrome.runtime.getURL('junk_channels.json'));
    const data = await response.json();
    
    // Build optimized Sets and Maps
    const newChannelSet = new Set();
    const newTypeMap = new Map();
    
    for (const channel of data.channels) {
      const normalizedName = channel.name.toLowerCase().trim();
      newChannelSet.add(normalizedName);
      newTypeMap.set(normalizedName, channel.type);
    }
    
    // Build suspected keywords Set
    const newKeywordSet = new Set(
      data.suspectedKeywords.map(k => k.toLowerCase().trim())
    );
    
    // Update caches
    channelSet = newChannelSet;
    channelTypeMap = newTypeMap;
    suspectedKeywords = newKeywordSet;
    
    // Store in chrome.storage (serialize Sets as Arrays)
    await chrome.storage.local.set({
      channelList: data.channels,
      channelSet: Array.from(newChannelSet),
      channelTypeMap: Array.from(newTypeMap.entries()),
      suspectedKeywords: data.suspectedKeywords,
      keywordSet: Array.from(newKeywordSet),
      version: data.version,
      totalChannels: data.totalChannels,
      categoryCounts: data.categoryCounts
    });
    
    dataLoaded = true;
    console.log(`PMax Sentry: Loaded ${data.totalChannels} channels, ${data.suspectedKeywords.length} keywords`);
    console.log('Categories:', data.categoryCounts);
    
  } catch (error) {
    console.error('PMax Sentry: Failed to load channels:', error);
  }
}

// Fast classification function
function classifyChannel(channelName) {
  if (!channelName || !dataLoaded) {
    return { tier: 'none', type: null, keyword: null };
  }
  
  const normalized = channelName.toLowerCase().trim();
  
  // Tier 1: O(1) exact match from master list
  if (channelSet.has(normalized)) {
    return {
      tier: 'tier1',
      type: channelTypeMap.get(normalized),
      keyword: null
    };
  }
  
  // Tier 2: Partial match for suspected keywords
  for (const keyword of suspectedKeywords) {
    if (normalized.includes(keyword)) {
      return {
        tier: 'tier2',
        type: 'Suspected',
        keyword: keyword
      };
    }
  }
  
  return { tier: 'none', type: null, keyword: null };
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'getChannelData') {
    chrome.storage.local.get(['channelList', 'suspectedKeywords'], (result) => {
      sendResponse({
        channels: result.channelList || [],
        suspectedKeywords: result.suspectedKeywords || [],
        totalCount: result.totalChannels || 0
      });
    });
    return true;
  }
  
  if (request.action === 'checkChannel') {
    const result = classifyChannel(request.channel);
    sendResponse(result);
    return true;
  }
  
  if (request.action === 'getStats') {
    chrome.storage.local.get(['categoryCounts', 'totalChannels'], (result) => {
      sendResponse({
        totalChannels: result.totalChannels || 0,
        categoryCounts: result.categoryCounts || {}
      });
    });
    return true;
  }
  
  if (request.action === 'reloadChannels') {
    loadAndOptimizedChannels().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});