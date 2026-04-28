// PMax Sentry - Content Script (Production)
// Optimized scanning with O(1) lookups and partial matching

(function() {
  'use strict';
  
  // Safe mode: Only run on placements page
  const isSafeMode = () => {
    return window.location.href.includes('cm/placements') || 
           window.location.href.includes('placements');
  };
  
  if (!isSafeMode()) {
    return;
  }
  
  // Logger utility
  const Logger = {
    log: (...args) => console.log('[PMax Sentry]', ...args),
    error: (...args) => console.error('[PMax Sentry]', ...args)
  };
  
  // State
  let foundPlacements = [];
  let suspectedPlacements = [];
  let totalWastedSpend = 0;
  let observer = null;
  let badgeInjected = false;
  
  // Optimized data structures
  let junkSet = new Set();
  let suspectedKeywords = [];
  let dataLoaded = false;
  
  // Colors
  const COLORS = {
    confirmed: '#fee2e2',  // Red - in master list
    suspected: '#fef3c7',  // Yellow - partial match
    border: '#ea4335'
  };
  
  // Initialize data
  async function initializeData() {
    try {
      const result = await chrome.storage.local.get(['junkSet', 'suspectedKeywords']);
      
      if (result.junkSet) {
        junkSet = new Set(result.junkSet);
      }
      
      if (result.suspectedKeywords) {
        suspectedKeywords = result.suspectedKeywords.map(k => k.toLowerCase());
      }
      
      dataLoaded = true;
      Logger.log(`Loaded ${junkSet.size} channels, ${suspectedKeywords.length} suspected keywords`);
    } catch (error) {
      Logger.error('Failed to initialize data:', error);
    }
  }
  
  // Inject Sentry Active badge
  function injectBadge() {
    if (badgeInjected || document.getElementById('pmax-sentry-badge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `
      <div style="
        position: fixed;
        top: 12px;
        right: 12px;
        background: rgba(26, 115, 232, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-family: Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(4px);
      ">
        <span style="font-size: 10px;">🛡️</span>
        <span>Sentry Active</span>
      </div>
    `;
    
    document.body.appendChild(badge);
    badgeInjected = true;
  }
  
  // Optimized channel classification
  function classifyChannel(channelName) {
    if (!channelName) return { type: 'none', keyword: null };
    
    const normalized = channelName.toLowerCase().trim();
    
    // O(1) exact match check
    if (junkSet.has(normalized)) {
      return { type: 'confirmed', keyword: null };
    }
    
    // Partial match for suspected keywords
    for (const keyword of suspectedKeywords) {
      if (normalized.includes(keyword)) {
        return { type: 'suspected', keyword };
      }
    }
    
    return { type: 'none', keyword: null };
  }
  
  // Highlight row based on classification
  function highlightRow(row, classification) {
    if (classification.type === 'confirmed') {
      row.style.backgroundColor = COLORS.confirmed;
      row.style.borderLeft = `4px solid ${COLORS.border}`;
      row.dataset.sentryStatus = 'confirmed';
    } else if (classification.type === 'suspected') {
      row.style.backgroundColor = COLORS.suspected;
      row.style.borderLeft = '4px solid #f59e0b'; // Amber border
      row.dataset.sentryStatus = 'suspected';
      row.title = `Suspected: contains "${classification.keyword}"`;
    }
    
    row.style.transition = 'background-color 0.3s ease';
  }
  
  // Initialize mutation observer
  function initMutationObserver() {
    if (observer) return;
    
    observer = new MutationObserver((mutations) => {
      const hasTableChanges = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          return node.nodeType === 1 && 
                 (node.tagName === 'TABLE' || 
                  node.querySelector?.('table') ||
                  node.textContent?.includes('Placement'));
        });
      });
      
      if (hasTableChanges && isSafeMode()) {
        reapplyHighlights();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Reapply highlights after SPA navigation
  async function reapplyHighlights() {
    if (!dataLoaded) await initializeData();
    
    const tableRows = document.querySelectorAll('table tr, [role="row"]');
    
    tableRows.forEach(row => {
      const rowText = row.textContent || '';
      const classification = classifyChannel(rowText);
      
      if (classification.type !== 'none') {
        highlightRow(row, classification);
      }
    });
  }
  
  // Extract spend value
  function extractSpendFromRow(row) {
    const cellTexts = Array.from(row.querySelectorAll('td, [role="cell"]'))
      .map(cell => cell.textContent || '');
    
    for (const text of cellTexts) {
      const match = text.match(/[£$€]\s*([\d,]+\.?\d*)/);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    return 0;
  }
  
  // Extract channel name
  function extractChannelName(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && (text.includes('youtube.com') || text.includes('youtu.be') || text.length > 3)) {
        return text;
      }
    }
    return row.textContent?.trim() || '';
  }
  
  // Main scan function
  async function findPlacements() {
    Logger.log('Starting optimized placement scan...');
    
    if (!dataLoaded) await initializeData();
    
    foundPlacements = [];
    suspectedPlacements = [];
    totalWastedSpend = 0;
    
    const tableRows = document.querySelectorAll('table tr, [role="row"]');
    
    tableRows.forEach(row => {
      const channelName = extractChannelName(row);
      const classification = classifyChannel(channelName);
      
      if (classification.type !== 'none') {
        const spend = extractSpendFromRow(row);
        const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"]');
        
        const placement = {
          channel: channelName.substring(0, 50), // Truncate long names
          spend,
          rowElement: row,
          checkboxElement: checkbox,
          classification
        };
        
        if (classification.type === 'confirmed') {
          foundPlacements.push(placement);
        } else {
          suspectedPlacements.push(placement);
        }
        
        highlightRow(row, classification);
      }
    });
    
    totalWastedSpend = foundPlacements.reduce((sum, p) => sum + p.spend, 0);
    
    Logger.log(`Scan complete: ${foundPlacements.length} confirmed, ${suspectedPlacements.length} suspected`);
    
    return {
      placements: foundPlacements.map(p => ({
        channel: p.channel,
        spend: p.spend,
        type: p.classification.type
      })),
      suspected: suspectedPlacements.map(p => ({
        channel: p.channel,
        spend: p.spend,
        keyword: p.classification.keyword
      })),
      totalSpend: totalWastedSpend,
      totalSuspectedSpend: suspectedPlacements.reduce((sum, p) => sum + p.spend, 0)
    };
  }
  
  // Perform exclusion
  async function performExclusion() {
    const allPlacements = [...foundPlacements, ...suspectedPlacements];
    
    if (allPlacements.length === 0) {
      return { success: true, excludedCount: 0 };
    }
    
    let excludedCount = 0;
    
    // Exclude confirmed first
    for (const placement of foundPlacements) {
      try {
        if (placement.checkboxElement) {
          placement.checkboxElement.click();
          excludedCount++;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (e) {
        Logger.error('Error excluding', placement.channel, e);
      }
    }
    
    // Then suspected
    for (const placement of suspectedPlacements) {
      try {
        if (placement.checkboxElement) {
          placement.checkboxElement.click();
          excludedCount++;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (e) {
        Logger.error('Error excluding suspected', placement.channel, e);
      }
    }
    
    // Trigger edit/exclude flow
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      const editBtn = findButtonByText('Edit');
      if (editBtn) {
        editBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const excludeBtn = findButtonByText('Exclude');
        if (excludeBtn) excludeBtn.click();
      }
    } catch (e) {
      Logger.error('Error in Edit/Exclude flow:', e);
    }
    
    return { success: true, excludedCount };
  }
  
  // Find button by text
  function findButtonByText(text) {
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      if (btn.textContent.toLowerCase().includes(text.toLowerCase())) {
        return btn;
      }
    }
    return null;
  }
  
  // Message listeners
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanPlacements') {
      findPlacements().then(result => {
        chrome.storage.local.set({ 
          wastedSpend: result.totalSpend,
          lastScan: Date.now()
        });
        sendResponse({ success: true, ...result });
      }).catch(error => {
        Logger.error('Scan error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      performExclusion().then(result => {
        sendResponse(result);
      }).catch(error => {
        Logger.error('Exclusion error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    
    if (request.action === 'getStats') {
      sendResponse({
        confirmed: foundPlacements.length,
        suspected: suspectedPlacements.length,
        totalSpend: totalWastedSpend
      });
      return true;
    }
  });
  
  // Initialize
  initializeData().then(() => {
    injectBadge();
    initMutationObserver();
    Logger.log('Content script loaded with production optimizations');
  });
})();