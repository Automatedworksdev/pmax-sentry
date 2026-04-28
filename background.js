// PMax Sentry - Background Service Worker
// Optimized for production with large dataset handling

// Channel data cache
let channelCache = null;
let suspectedKeywordsCache = null;

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('PMax Sentry: Initializing production master list...');
  loadAndOptimizeChannels();
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Load and optimize channel data for O(1) lookups
async function loadAndOptimizeChannels() {
  try {
    const response = await fetch(chrome.runtime.getURL('junk_channels.json'));
    const data = await response.json();
    
    // Create optimized Set for O(1) lookups
    const channelSet = new Set(data.channels.map(ch => ch.toLowerCase()));
    
    // Create suspected keywords Set
    const keywordSet = new Set(data.suspectedKeywords.map(k => k.toLowerCase()));
    
    // Store optimized data
    await chrome.storage.local.set({
      junkList: data.channels,           // Array for iteration
      junkSet: Array.from(channelSet),   // Serialized Set
      suspectedKeywords: data.suspectedKeywords,
      keywordSet: Array.from(keywordSet),
      version: data.version,
      totalChannels: data.totalChannels
    });
    
    // Cache in memory for quick access
    channelCache = channelSet;
    suspectedKeywordsCache = keywordSet;
    
    console.log(`PMax Sentry: Loaded ${data.totalChannels} channels, ${data.suspectedKeywords.length} suspected keywords`);
  } catch (error) {
    console.error('PMax Sentry: Failed to load channels:', error);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJunkList') {
    // Return optimized data
    chrome.storage.local.get(['junkList', 'suspectedKeywords'], (result) => {
      sendResponse({
        junkList: result.junkList || [],
        suspectedKeywords: result.suspectedKeywords || []
      });
    });
    return true;
  }
  
  if (request.action === 'checkChannel') {
    // Fast O(1) channel lookup
    const normalizedChannel = request.channel.toLowerCase();
    const isJunk = channelCache ? channelCache.has(normalizedChannel) : false;
    
    // Check for suspected keywords
    let isSuspected = false;
    let matchedKeyword = null;
    
    if (suspectedKeywordsCache) {
      for (const keyword of suspectedKeywordsCache) {
        if (normalizedChannel.includes(keyword)) {
          isSuspected = true;
          matchedKeyword = keyword;
          break;
        }
      }
    }
    
    sendResponse({ isJunk, isSuspected, matchedKeyword });
    return true;
  }
  
  if (request.action === 'updateWastedSpend') {
    chrome.storage.local.set({ wastedSpend: request.amount }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'reloadChannels') {
    loadAndOptimizeChannels().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});