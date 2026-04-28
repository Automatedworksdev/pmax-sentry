// PMax Sentry Content Script v2.2 - Fixed License Check

(function() {
  'use strict';
  
  console.log('[PMax Sentry] Content script loaded on:', window.location.href);
  
  // Safe mode detection
  const isSafeMode = () => {
    const url = window.location.href.toLowerCase();
    return url.includes('cm/placements') || 
           url.includes('placements') ||
           url.includes('mock_google_ads');
  };
  
  if (!isSafeMode()) {
    console.log('[PMax Sentry] Not in safe mode, exiting');
    return;
  }
  
  console.log('[PMax Sentry] Content Script Loaded - Safe Mode Active');
  
  // State
  let isLicensed = false;
  let channelSet = new Set();
  let suspectedKeywords = new Set();
  let dataLoaded = false;
  let highlightSuspected = true;
  
  // Tier tracking
  let tier1Placements = [];
  let tier2Placements = [];
  let totalSpend = { tier1: 0, tier2: 0 };
  
  // Colors
  const COLORS = {
    tier1: { bg: '#fee2e2', border: '#dc2626' },
    tier2: { bg: '#fef3c7', border: '#f59e0b' }
  };
  
  // Initialize
  async function initialize() {
    console.log('[PMax Sentry] Initializing...');
    
    // Check for license - using correct key
    const result = await chrome.storage.local.get(['licensed', 'channelSet', 'suspectedKeywords']);
    
    console.log('[PMax Sentry] Storage data:', result);
    
    isLicensed = result.licensed === true;
    
    if (isLicensed && result.channelSet) {
      channelSet = new Set(result.channelSet);
      suspectedKeywords = new Set(result.suspectedKeywords || []);
      dataLoaded = true;
      console.log(`[PMax Sentry] Licensed: ${channelSet.size} channels loaded`);
    } else {
      console.log('[PMax Sentry] Not licensed or no data');
    }
    
    injectBadge();
  }
  
  // Inject badge
  function injectBadge() {
    if (document.getElementById('pmax-sentry-badge')) return;
    
    const statusText = isLicensed ? '🛡️ Sentry Active' : '🔒 License Required';
    const statusColor = isLicensed ? 'rgba(26, 115, 232, 0.9)' : 'rgba(156, 163, 175, 0.9)';
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `<div style="position:fixed;top:12px;right:12px;background:${statusColor};color:white;padding:8px 14px;border-radius:6px;font-family:Roboto,sans-serif;font-size:12px;font-weight:500;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${statusText}</div>`;
    document.body.appendChild(badge);
    console.log('[PMax Sentry] Badge injected');
  }
  
  // Classify channel
  function classifyChannel(channelName) {
    if (!isLicensed || !dataLoaded) {
      return { tier: 'unlicensed' };
    }
    
    const normalized = channelName.toLowerCase().trim();
    
    // Tier 1: Exact match
    if (channelSet.has(normalized)) {
      return { tier: 'tier1' };
    }
    
    // Tier 2: Keyword match
    for (const keyword of suspectedKeywords) {
      if (normalized.includes(keyword)) {
        return { tier: 'tier2', keyword };
      }
    }
    
    return { tier: 'none' };
  }
  
  // Extract data from row
  function extractChannelName(row) {
    const cells = row.querySelectorAll('td');
    for (const cell of cells) {
      if (cell.querySelector('input[type="checkbox"]')) continue;
      const text = cell.textContent?.trim();
      if (text && text.length > 2 && !text.match(/^[\d,]+$/)) {
        // Remove status badges
        return text.replace(/\s*(Confirmed Junk|Suspected Junk|Clean)$/i, '').trim();
      }
    }
    return '';
  }
  
  function extractSpend(row) {
    const cells = row.querySelectorAll('td');
    for (const cell of cells) {
      const match = cell.textContent?.match(/[£$€]\s*([\d,]+\.?\d*)/);
      if (match) {
        return parseFloat(match[1].replace(/,/g, '')) || 0;
      }
    }
    return 0;
  }
  
  // Highlight row
  function highlightRow(row, classification) {
    const colors = classification.tier === 'tier1' ? COLORS.tier1 : COLORS.tier2;
    row.style.backgroundColor = colors.bg;
    row.style.borderLeft = `4px solid ${colors.border}`;
    row.dataset.sentryTier = classification.tier;
  }
  
  // Scan placements
  async function scanPlacements() {
    console.log('[PMax Sentry] Scanning...');
    
    if (!isLicensed) {
      console.log('[PMax Sentry] Not licensed, returning error');
      return { error: 'License required', needsLicense: true };
    }
    
    if (!dataLoaded) {
      console.log('[PMax Sentry] Data not loaded');
      return { error: 'Data not loaded. Reactivate license.', needsLicense: true };
    }
    
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    
    const rows = document.querySelectorAll('table tbody tr, table tr');
    console.log(`[PMax Sentry] Found ${rows.length} rows`);
    
    rows.forEach((row) => {
      if (row.querySelector('th')) return; // Skip headers
      
      const name = extractChannelName(row);
      if (!name) return;
      
      const classification = classifyChannel(name);
      console.log(`[PMax Sentry] "${name}" -> ${classification.tier}`);
      
      if (classification.tier === 'tier1' || classification.tier === 'tier2') {
        const spend = extractSpend(row);
        const placement = { channel: name, spend, row };
        
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
    
    console.log(`[PMax Sentry] Scan complete: ${tier1Placements.length} tier1, ${tier2Placements.length} tier2`);
    
    return {
      success: true,
      tier1: tier1Placements.map(p => ({ channel: p.channel, spend: p.spend })),
      tier2: tier2Placements.map(p => ({ channel: p.channel, spend: p.spend, keyword: p.classification?.keyword })),
      totalSpend,
      counts: { tier1: tier1Placements.length, tier2: tier2Placements.length }
    };
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[PMax Sentry] Message received:', request.action);
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        console.log('[PMax Sentry] Sending response:', result);
        sendResponse(result);
      });
      return true;
    }
    
    if (request.action === 'ping') {
      sendResponse({ pong: true, licensed: isLicensed, dataLoaded });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      const all = [...tier1Placements, ...tier2Placements];
      let count = 0;
      all.forEach(p => {
        const checkbox = p.row.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.click();
          count++;
        }
      });
      sendResponse({ success: true, excludedCount: count });
      return true;
    }
    
    if (request.action === 'toggleSuspected') {
      highlightSuspected = request.enabled;
      sendResponse({ success: true });
      return true;
    }
  });
  
  // Start
  initialize();
  
})();