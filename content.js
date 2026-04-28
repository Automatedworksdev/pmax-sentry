// PMax Sentry - Content Script v2.0
// Dual-Tier Detection with Set-based O(1) lookups

(function() {
  'use strict';
  
  // Safe mode check
  const isSafeMode = () => {
    return window.location.href.includes('cm/placements') || 
           window.location.href.includes('placements');
  };
  
  if (!isSafeMode()) return;
  
  // Logger
  const Logger = {
    log: (...args) => console.log('[PMax Sentry]', ...args),
    error: (...args) => console.error('[PMax Sentry]', ...args)
  };
  
  // State
  let tier1Placements = [];
  let tier2Placements = [];
  let totalWastedSpend = { tier1: 0, tier2: 0 };
  let observer = null;
  let badgeInjected = false;
  let highlightSuspected = true; // Toggle state
  
  // Optimized data structures (loaded from background)
  let channelSet = new Set();
  let suspectedKeywords = new Set();
  let dataLoaded = false;
  
  // Colors for dual-tier
  const COLORS = {
    tier1: { bg: '#fee2e2', border: '#dc2626' },      // Red - confirmed
    tier2: { bg: '#fef3c7', border: '#f59e0b' },       // Yellow - suspected
    badge: 'rgba(26, 115, 232, 0.9)'
  };
  
  // Initialize data from storage
  async function initializeData() {
    try {
      const result = await chrome.storage.local.get(['channelSet', 'keywordSet']);
      
      if (result.channelSet) {
        channelSet = new Set(result.channelSet);
      }
      
      if (result.keywordSet) {
        suspectedKeywords = new Set(result.keywordSet);
      }
      
      dataLoaded = true;
      Logger.log(`Loaded ${channelSet.size} channels, ${suspectedKeywords.size} suspected keywords`);
    } catch (error) {
      Logger.error('Failed to initialize:', error);
    }
  }
  
  // Inject badge
  function injectBadge() {
    if (badgeInjected) return;
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `
      <div style="
        position: fixed;
        top: 12px;
        right: 12px;
        background: ${COLORS.badge};
        color: white;
        padding: 8px 14px;
        border-radius: 6px;
        font-family: Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(4px);
      ">
        <span>🛡️</span>
        <span>Sentry Active</span>
        <span id="sentry-count" style="
          background: rgba(255,255,255,0.2);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
        ">0 found</span>
      </div>
    `;
    
    document.body.appendChild(badge);
    badgeInjected = true;
  }
  
  // Update badge counter
  function updateBadgeCounter() {
    const badge = document.getElementById('sentry-count');
    if (badge) {
      const total = tier1Placements.length + (highlightSuspected ? tier2Placements.length : 0);
      badge.textContent = `${total} found`;
    }
  }
  
  // Dual-tier classification with O(1) Set lookup
  function classifyChannel(channelName) {
    if (!channelName || !dataLoaded) {
      return { tier: 'none', keyword: null };
    }
    
    const normalized = channelName.toLowerCase().trim();
    
    // Tier 1: O(1) exact match
    if (channelSet.has(normalized)) {
      return { tier: 'tier1', keyword: null };
    }
    
    // Tier 2: Partial keyword match (only if enabled)
    if (highlightSuspected) {
      for (const keyword of suspectedKeywords) {
        if (normalized.includes(keyword)) {
          return { tier: 'tier2', keyword };
        }
      }
    }
    
    return { tier: 'none', keyword: null };
  }
  
  // Highlight row based on tier
  function highlightRow(row, classification) {
    if (classification.tier === 'none') return;
    
    const colors = classification.tier === 'tier1' ? COLORS.tier1 : COLORS.tier2;
    
    row.style.backgroundColor = colors.bg;
    row.style.borderLeft = `4px solid ${colors.border}`;
    row.style.transition = 'all 0.2s ease';
    row.dataset.sentryTier = classification.tier;
    
    if (classification.keyword) {
      row.title = `Suspected: "${classification.keyword}"`;
    }
  }
  
  // Extract spend from row
  function extractSpend(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    for (const cell of cells) {
      const match = cell.textContent?.match(/[£$€]\s*([\d,]+\.?\d*)/);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) return amount;
      }
    }
    return 0;
  }
  
  // Extract channel name
  function extractChannelName(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2) return text;
    }
    return row.textContent?.trim().substring(0, 100) || '';
  }
  
  // Main scan function
  async function scanPlacements() {
    Logger.log('Starting dual-tier scan...');
    
    if (!dataLoaded) await initializeData();
    
    tier1Placements = [];
    tier2Placements = [];
    totalWastedSpend = { tier1: 0, tier2: 0 };
    
    const rows = document.querySelectorAll('table tr, [role="row"]');
    
    rows.forEach(row => {
      const channelName = extractChannelName(row);
      const classification = classifyChannel(channelName);
      
      if (classification.tier !== 'none') {
        const spend = extractSpend(row);
        const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"]');
        
        const placement = {
          channel: channelName.substring(0, 60),
          spend,
          rowElement: row,
          checkboxElement: checkbox,
          classification
        };
        
        if (classification.tier === 'tier1') {
          tier1Placements.push(placement);
          totalWastedSpend.tier1 += spend;
        } else if (classification.tier === 'tier2') {
          tier2Placements.push(placement);
          totalWastedSpend.tier2 += spend;
        }
        
        highlightRow(row, classification);
      }
    });
    
    updateBadgeCounter();
    
    Logger.log(`Scan complete: ${tier1Placements.length} Tier 1, ${tier2Placements.length} Tier 2`);
    
    return {
      tier1: tier1Placements.map(p => ({ channel: p.channel, spend: p.spend })),
      tier2: tier2Placements.map(p => ({ channel: p.channel, spend: p.spend, keyword: p.classification.keyword })),
      totalSpend: totalWastedSpend,
      counts: {
        tier1: tier1Placements.length,
        tier2: tier2Placements.length
      }
    };
  }
  
  // Perform exclusion
  async function performExclusion() {
    const allPlacements = [...tier1Placements];
    if (highlightSuspected) {
      allPlacements.push(...tier2Placements);
    }
    
    if (allPlacements.length === 0) {
      return { success: true, excludedCount: 0 };
    }
    
    let excludedCount = 0;
    
    // Exclude Tier 1 first
    for (const p of tier1Placements) {
      try {
        if (p.checkboxElement) {
          p.checkboxElement.click();
          excludedCount++;
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (e) {}
    }
    
    // Then Tier 2 if enabled
    if (highlightSuspected) {
      for (const p of tier2Placements) {
        try {
          if (p.checkboxElement) {
            p.checkboxElement.click();
            excludedCount++;
            await new Promise(r => setTimeout(r, 100));
          }
        } catch (e) {}
      }
    }
    
    // Trigger exclusion flow
    try {
      await new Promise(r => setTimeout(r, 300));
      const editBtn = [...document.querySelectorAll('button, [role="button"]')]
        .find(b => b.textContent.toLowerCase().includes('edit'));
      if (editBtn) {
        editBtn.click();
        await new Promise(r => setTimeout(r, 400));
        
        const excludeBtn = [...document.querySelectorAll('button, [role="button"]')]
          .find(b => b.textContent.toLowerCase().includes('exclude'));
        if (excludeBtn) excludeBtn.click();
      }
    } catch (e) {}
    
    return { success: true, excludedCount };
  }
  
  // Reapply highlights
  async function reapplyHighlights() {
    if (!dataLoaded) await initializeData();
    
    const rows = document.querySelectorAll('table tr, [role="row"]');
    rows.forEach(row => {
      const name = extractChannelName(row);
      const classification = classifyChannel(name);
      if (classification.tier !== 'none') {
        highlightRow(row, classification);
      }
    });
    
    updateBadgeCounter();
  }
  
  // Mutation observer
  function initObserver() {
    if (observer) return;
    
    observer = new MutationObserver(() => {
      if (isSafeMode()) reapplyHighlights();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Message listeners
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        chrome.storage.local.set({ lastScan: Date.now() });
        sendResponse({ success: true, ...result });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      performExclusion().then(result => {
        sendResponse(result);
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    
    if (request.action === 'toggleSuspected') {
      highlightSuspected = request.enabled;
      reapplyHighlights();
      sendResponse({ success: true, enabled: highlightSuspected });
      return true;
    }
    
    if (request.action === 'getStats') {
      sendResponse({
        tier1: tier1Placements.length,
        tier2: tier2Placements.length,
        spend: totalWastedSpend,
        suspectedEnabled: highlightSuspected
      });
      return true;
    }
  });
  
  // Initialize
  initializeData().then(() => {
    injectBadge();
    initObserver();
    Logger.log('PMax Sentry v2.0 loaded with dual-tier detection');
  });
})();