// PMax Sentry Content Script v2.1 - Licensed Edition
// Requires license validation before loading channel data

(function() {
  'use strict';
  
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
  let isLicensed = false;
  let tier1Placements = [];
  let tier2Placements = [];
  let totalSpend = { tier1: 0, tier2: 0 };
  let observer = null;
  let badgeInjected = false;
  let highlightSuspected = true;
  
  // Data caches (loaded from background via storage)
  let channelSet = new Set();
  let suspectedKeywords = new Set();
  let dataLoaded = false;
  
  // Colors
  const COLORS = {
    tier1: { bg: '#fee2e2', border: '#dc2626' },
    tier2: { bg: '#fef3c7', border: '#f59e0b' },
    unlicensed: { bg: '#f3f4f6', border: '#9ca3af' }
  };
  
  // Initialize - check license status first
  async function initialize() {
    const result = await chrome.storage.local.get(['licenseValidated', 'channelSet', 'suspectedKeywords']);
    
    isLicensed = result.licenseValidated === true;
    
    if (isLicensed && result.channelSet) {
      channelSet = new Set(result.channelSet);
      suspectedKeywords = new Set(result.suspectedKeywords || []);
      dataLoaded = true;
      Logger.log(`Licensed: ${channelSet.size} channels loaded`);
    } else {
      Logger.log('Unlicensed mode - scan disabled');
    }
    
    injectBadge();
    initObserver();
  }
  
  // Inject status badge
  function injectBadge() {
    if (badgeInjected) return;
    
    const statusColor = isLicensed ? 'rgba(26, 115, 232, 0.9)' : 'rgba(156, 163, 175, 0.9)';
    const statusText = isLicensed ? 'Sentry Active' : 'License Required';
    const statusIcon = isLicensed ? '🛡️' : '🔒';
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `
      <div style="
        position: fixed;
        top: 12px;
        right: 12px;
        background: ${statusColor};
        color: white;
        padding: 8px 14px;
        border-radius: 6px;
        font-family: Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: ${isLicensed ? 'default' : 'pointer'};
      ">
        <span>${statusIcon}</span>
        <span>${statusText}</span>
      </div>
    `;
    
    if (!isLicensed) {
      badge.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openLicensePanel' });
      });
    }
    
    document.body.appendChild(badge);
    badgeInjected = true;
  }
  
  // Classification using background-provided data
  function classifyChannel(channelName) {
    if (!isLicensed || !dataLoaded) {
      return { tier: 'unlicensed', keyword: null };
    }
    
    const normalized = channelName.toLowerCase().trim();
    
    // Tier 1: O(1) exact match
    if (channelSet.has(normalized)) {
      return { tier: 'tier1', keyword: null };
    }
    
    // Tier 2: Keyword match
    if (highlightSuspected) {
      for (const keyword of suspectedKeywords) {
        if (normalized.includes(keyword)) {
          return { tier: 'tier2', keyword };
        }
      }
    }
    
    return { tier: 'none', keyword: null };
  }
  
  // Highlight row
  function highlightRow(row, classification) {
    if (classification.tier === 'none') return;
    
    let colors;
    if (classification.tier === 'tier1') {
      colors = COLORS.tier1;
    } else if (classification.tier === 'tier2') {
      colors = COLORS.tier2;
    } else {
      colors = COLORS.unlicensed;
    }
    
    row.style.backgroundColor = colors.bg;
    row.style.borderLeft = `4px solid ${colors.border}`;
    row.style.transition = 'all 0.2s ease';
    row.dataset.sentryTier = classification.tier;
    
    if (classification.keyword) {
      row.title = `Suspected: "${classification.keyword}"`;
    }
  }
  
  // Extract data
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
  
  function extractChannelName(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2) return text;
    }
    return '';
  }
  
  // Scan placements
  async function scanPlacements() {
    if (!isLicensed) {
      return { error: 'License required', needsLicense: true };
    }
    
    Logger.log('Scanning with licensed data...');
    
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    
    const rows = document.querySelectorAll('table tr, [role="row"]');
    
    rows.forEach(row => {
      const name = extractChannelName(row);
      const classification = classifyChannel(name);
      
      if (classification.tier === 'tier1' || classification.tier === 'tier2') {
        const spend = extractSpend(row);
        const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"]');
        
        const placement = {
          channel: name.substring(0, 60),
          spend,
          rowElement: row,
          checkboxElement: checkbox,
          classification
        };
        
        if (classification.tier === 'tier1') {
          tier1Placements.push(placement);
          totalSpend.tier1 += spend;
        } else {
          tier2Placements.push(placement);
          totalSpend.tier2 += spend;
        }
        
        highlightRow(row, classification);
      }
    });
    
    return {
      tier1: tier1Placements.map(p => ({ channel: p.channel, spend: p.spend })),
      tier2: tier2Placements.map(p => ({ channel: p.channel, spend: p.spend, keyword: p.classification.keyword })),
      totalSpend,
      counts: {
        tier1: tier1Placements.length,
        tier2: tier2Placements.length
      }
    };
  }
  
  // Exclude
  async function performExclusion() {
    const all = [...tier1Placements];
    if (highlightSuspected) all.push(...tier2Placements);
    
    if (all.length === 0) return { success: true, excludedCount: 0 };
    
    let count = 0;
    
    for (const p of all) {
      try {
        if (p.checkboxElement) {
          p.checkboxElement.click();
          count++;
          await new Promise(r => setTimeout(r, 150));
        }
      } catch (e) {}
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
    
    return { success: true, excludedCount: count };
  }
  
  // Reapply highlights
  async function reapplyHighlights() {
    if (!isLicensed) return;
    
    const rows = document.querySelectorAll('table tr, [role="row"]');
    rows.forEach(row => {
      const name = extractChannelName(row);
      const classification = classifyChannel(name);
      if (classification.tier !== 'none') {
        highlightRow(row, classification);
      }
    });
  }
  
  // Mutation observer
  function initObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (isSafeMode()) reapplyHighlights();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        sendResponse({ success: !result.error, ...result });
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
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === 'getStats') {
      sendResponse({
        licensed: isLicensed,
        tier1: tier1Placements.length,
        tier2: tier2Placements.length,
        spend: totalSpend
      });
      return true;
    }
    
    if (request.action === 'licenseUpdated') {
      // Reload from storage
      initialize();
      sendResponse({ success: true });
      return true;
    }
  });
  
  // Start
  initialize();
  Logger.log('Content script initialized');
})();