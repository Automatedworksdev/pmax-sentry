// PMax Sentry Content Script v2.1 - Licensed Edition
// Requires license validation before loading channel data

(function() {
  'use strict';
  
  console.log('[PMax Sentry] Content script loaded on:', window.location.href);
  
  // Safe mode detection - expanded for mock testing
  const isSafeMode = () => {
    const url = window.location.href.toLowerCase();
    const isSafe = url.includes('cm/placements') || 
           url.includes('placements') ||
           url.includes('mock_google_ads');
    console.log('[PMax Sentry] Safe mode check:', isSafe, 'URL:', url);
    return isSafe;
  };
  
  if (!isSafeMode()) {
    console.log('[PMax Sentry] Not in safe mode, exiting');
    return;
  }
  
  console.log('[PMax Sentry] Content Script Loaded - Safe Mode Active');
  
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
  let messageRetryCount = 0;
  const MAX_RETRIES = 3;
  
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
    Logger.log('Initializing...');
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
    
    // Notify background that content script is ready
    sendMessageWithRetry({ action: 'contentScriptReady' });
  }
  
  // Send message with retry
  function sendMessageWithRetry(message, retryCount = 0) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          Logger.error('Message failed:', chrome.runtime.lastError.message);
          if (retryCount < MAX_RETRIES) {
            Logger.log(`Retrying message (${retryCount + 1}/${MAX_RETRIES})...`);
            setTimeout(() => sendMessageWithRetry(message, retryCount + 1), 500);
          }
        } else {
          Logger.log('Message succeeded:', response);
        }
      });
    } catch (e) {
      Logger.error('Exception sending message:', e);
      if (retryCount < MAX_RETRIES) {
        Logger.log(`Retrying after exception (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => sendMessageWithRetry(message, retryCount + 1), 500);
      }
    }
  }
  
  // Inject status badge
  function injectBadge() {
    if (badgeInjected) return;
    
    const statusColor = isLicensed ? 'rgba(26, 115, 232, 0.9)' : 'rgba(156, 163, 175, 0.9)';
    const statusText = isLicensed ? '🛡️ Sentry Active' : '🔒 License Required';
    
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
      "
      onclick="${isLicensed ? '' : "chrome.runtime.sendMessage({action:'openLicensePanel'})"}"
      >
        <span>${statusText}</span>
      </div>
    `;
    
    document.body.appendChild(badge);
    badgeInjected = true;
    Logger.log('Badge injected');
  }
  
  // Classification using background-provided data
  function classifyChannel(channelName) {
    if (!isLicensed || !dataLoaded) {
      return { tier: 'unlicensed', keyword: null };
    }
    
    const normalized = channelName.toLowerCase().trim();
    
    // Tier 1: O(1) exact match
    if (channelSet.has(normalized)) {
      Logger.log(`Tier 1 match: "${normalized}"`);
      return { tier: 'tier1', keyword: null };
    }
    
    // Tier 2: Keyword match
    if (highlightSuspected) {
      for (const keyword of suspectedKeywords) {
        if (normalized.includes(keyword)) {
          Logger.log(`Tier 2 match: "${normalized}" contains "${keyword}"`);
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
      // Skip checkbox cells
      if (cell.querySelector('input[type="checkbox"]')) continue;
      
      const text = cell.textContent?.trim();
      // Look for meaningful text (channel names)
      if (text && text.length > 2 && !text.match(/^[\d,]+$/)) {
        // Remove badge text like "Confirmed Junk", "Suspected Junk", "Clean"
        return text.replace(/\s*(Confirmed Junk|Suspected Junk|Clean)$/i, '').trim();
      }
    }
    return '';
  }
  
  // Scan placements
  async function scanPlacements() {
    Logger.log('Starting scan...');
    
    if (!isLicensed) {
      Logger.log('License required for scan');
      return { error: 'License required', needsLicense: true };
    }
    
    Logger.log(`Scanning with ${channelSet.size} channels, ${suspectedKeywords.size} keywords`);
    
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    
    // Try multiple selectors for rows
    let rows = document.querySelectorAll('table tr, [role="row"], .particle-table-row, tr[data-row-id]');
    Logger.log(`Found ${rows.length} rows`);
    
    if (rows.length === 0) {
      Logger.error('No rows found on page');
      return { error: 'No placement data found', success: false };
    }
    
    rows.forEach((row, index) => {
      // Skip header rows
      if (row.querySelector('th') || row.closest('thead')) return;
      
      const name = extractChannelName(row);
      if (!name) return;
      
      Logger.log(`Row ${index}: "${name}"`);
      
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
    
    Logger.log(`Scan complete: ${tier1Placements.length} tier1, ${tier2Placements.length} tier2`);
    
    return {
      success: true,
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
    Logger.log('Starting exclusion...');
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
      } catch (e) {
        Logger.error('Error clicking checkbox:', e);
      }
    }
    
    // Trigger exclusion flow (Google Ads specific)
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
    } catch (e) {
      Logger.error('Error in exclusion flow:', e);
    }
    
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
    Logger.log('Observer initialized');
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    Logger.log('Received message:', request.action);
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        Logger.log('Scan result:', result);
        sendResponse(result);
      }).catch(err => {
        Logger.error('Scan error:', err);
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      performExclusion().then(result => {
        sendResponse(result);
      }).catch(err => {
        Logger.error('Exclusion error:', err);
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
      initialize();
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === 'ping') {
      sendResponse({ pong: true, safeMode: isSafeMode() });
      return true;
    }
  });
  
  // Start
  Logger.log('Starting initialization...');
  initialize();
  
})();