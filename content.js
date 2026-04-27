// PMax Sentry - Content Script (Production)
// Scans Google Ads UI for junk placements and performs exclusions

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
  
  // Logger utility (dev mode only)
  const Logger = {
    log: (...args) => {
      if (typeof DEV_MODE !== 'undefined' && DEV_MODE) {
        console.log('[PMax Sentry]', ...args);
      }
    },
    error: (...args) => {
      if (typeof DEV_MODE !== 'undefined' && DEV_MODE) {
        console.error('[PMax Sentry]', ...args);
      }
    }
  };
  
  // Keep track of found placements
  let foundPlacements = [];
  let totalWastedSpend = 0;
  let observer = null;
  let badgeInjected = false;
  
  // Inject Sentry Active badge
  function injectBadge() {
    if (badgeInjected) return;
    
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
    
    Logger.log('Badge injected');
  }
  
  // Initialize mutation observer for SPA navigation
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
    const { junkList } = await chrome.storage.local.get('junkList');
    if (!junkList) return;
    
    const tableRows = document.querySelectorAll('table tr, [role="row"]');
    
    tableRows.forEach(row => {
      const rowText = row.textContent || '';
      junkList.forEach(channel => {
        if (rowText.toLowerCase().includes(channel.toLowerCase())) {
          highlightRow(row);
        }
      });
    });
  }
  
  // Highlight a row
  function highlightRow(row) {
    row.style.backgroundColor = '#fee2e2';
    row.style.borderLeft = '4px solid #ea4335';
    row.style.transition = 'background-color 0.3s ease';
  }
  
  // Main scan function
  async function findPlacements() {
    Logger.log('Starting placement scan...');
    
    foundPlacements = [];
    totalWastedSpend = 0;
    
    const { junkList } = await chrome.storage.local.get('junkList');
    if (!junkList || junkList.length === 0) {
      return { placements: [], totalSpend: 0 };
    }
    
    const tableRows = document.querySelectorAll('table tr, [role="row"]');
    
    tableRows.forEach(row => {
      const rowText = row.textContent || '';
      
      junkList.forEach(channel => {
        if (rowText.toLowerCase().includes(channel.toLowerCase())) {
          const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"]');
          
          foundPlacements.push({
            channel: channel,
            spend: extractSpendFromRow(row),
            rowElement: row,
            checkboxElement: checkbox
          });
          
          highlightRow(row);
        }
      });
    });
    
    totalWastedSpend = foundPlacements.reduce((sum, p) => sum + p.spend, 0);
    
    return {
      placements: foundPlacements.map(p => ({
        channel: p.channel,
        spend: p.spend
      })),
      totalSpend: totalWastedSpend
    };
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
  
  // Perform exclusion
  async function performExclusion() {
    if (foundPlacements.length === 0) {
      return { success: true, excludedCount: 0 };
    }
    
    let excludedCount = 0;
    
    for (const placement of foundPlacements) {
      try {
        if (placement.checkboxElement) {
          placement.checkboxElement.click();
          excludedCount++;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (e) {
        Logger.error('Error excluding', placement.channel, e);
      }
    }
    
    try {
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
        chrome.storage.local.set({ wastedSpend: result.totalSpend });
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
  });
  
  // Initialize
  injectBadge();
  initMutationObserver();
  Logger.log('Content script loaded and ready');
})();