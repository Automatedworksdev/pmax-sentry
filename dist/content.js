/**
 * PMax Sentry Content Script v3.0 - Proxy Architecture
 * 
 * Changes in v3.0:
 * - No local channel database
 * - Collects all channels first, then sends ONE bulk request to proxy
 * - All classifications come from proxy server
 * - Caches results in memory only (no localStorage)
 */

(function() {
  'use strict';
  
  // Proxy URL
  const PROXY_URL = 'https://pmax-sentry-proxy-git-master-automatedworksdevs-projects.vercel.app';
  
  console.log('[PMax Sentry] Content script v3.0 loaded (Proxy Architecture)');
  
  // Safe mode detection - include mock test file
  const isSafeMode = () => {
    const url = window.location.href.toLowerCase();
    return url.includes('cm/placements') || 
           url.includes('placements') || 
           url.includes('mock_google_ads') ||
           url.includes('mock_test');
  };
  
  if (!isSafeMode()) {
    console.log('[PMax Sentry] Not in safe mode');
    return;
  }
  
  console.log('[PMax Sentry] Safe mode active');
  
  // State
  let isLicensed = false;
  let licenseKey = null;
  let cachedClassifications = {}; // channel -> classification
  let highlightSuspected = true;
  
  // Results
  let tier1Placements = [];
  let tier2Placements = [];
  let totalSpend = { tier1: 0, tier2: 0 };
  let categoryTotals = {};
  
  // Colors
  const COLORS = {
    tier1: { bg: '#fee2e2', border: '#dc2626' },
    tier2: { bg: '#fef3c7', border: '#f59e0b' }
  };
  
  const CATEGORY_COLORS = {
    'Kids': '#3b82f6',
    'Gaming': '#8b5cf6',
    'MFA': '#ef4444',
    'ASMR': '#10b981',
    'News': '#f59e0b',
    'Music': '#ec4899',
    'Utility Apps': '#f97316',
    'Foreign Language': '#06b6d4',
    'Low Quality': '#6b7280'
  };
  
  // Initialize
  async function initialize() {
    console.log('[PMax] Initializing content script...');
    
    const result = await chrome.storage.local.get(['licensed', 'licenseKey']);
    isLicensed = result.licensed === true;
    licenseKey = result.licenseKey;
    
    console.log(`[PMax] License status: ${isLicensed ? 'Active' : 'Inactive'}`);
    
    injectBadge();
  }
  
  // Badge
  function injectBadge() {
    if (document.getElementById('pmax-sentry-badge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `<div style="position:fixed;top:12px;right:12px;background:${isLicensed ? 'rgba(26,115,232,0.9)' : 'rgba(156,163,175,0.9)'};color:white;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:500;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${isLicensed ? '🛡️ Sentry Active (v3.0)' : '🔒 License Required'}</div>`;
    document.body.appendChild(badge);
  }
  
  // Extract data from row
  function extractChannelData(row) {
    const link = row.querySelector('td a[href]');
    
    if (link) {
      const href = link.getAttribute('href');
      const displayName = link.textContent?.trim() || '';
      
      return { 
        displayName: displayName,
        placementId: href
      };
    }
    
    // Fallback: no link found
    const cells = row.querySelectorAll('td');
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2 && !text.match(/^[\d,]+$/) && !text.match(/[£$€]/)) {
        return { displayName: text, placementId: text };
      }
    }
    
    return { displayName: '', placementId: '' };
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
    const catColor = CATEGORY_COLORS[classification.category] || CATEGORY_COLORS['Low Quality'];
    
    row.style.backgroundColor = colors.bg;
    row.style.borderLeft = `4px solid ${colors.border}`;
    row.dataset.sentryTier = classification.tier;
    row.dataset.sentryCategory = classification.category;
    
    // Add category badge to first cell
    const cells = row.querySelectorAll('td');
    const nameCell = cells[0];
    if (nameCell && !nameCell.querySelector('.sentry-cat-badge')) {
      const badge = document.createElement('span');
      badge.className = 'sentry-cat-badge';
      badge.style.cssText = `display:inline-block;margin-left:8px;padding:2px 6px;border-radius:4px;font-size:10px;background:${catColor};color:white;font-weight:500;`;
      badge.textContent = classification.category;
      nameCell.appendChild(badge);
    }
  }
  
  // Scan - NEW: Collect all channels first, then batch classify
  async function scanPlacements() {
    console.log('[PMax] Starting scan...', { isLicensed });
    
    if (!isLicensed) {
      return { error: 'License required', needsLicense: true };
    }
    
    // Reset results
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    categoryTotals = {};
    cachedClassifications = {};
    
    // Step 1: Collect all channels from the page
    const rows = document.querySelectorAll('table tbody tr, table tr');
    const channelsToClassify = [];
    const rowData = []; // Keep reference to row for later
    
    console.log(`[PMax] Found ${rows.length} rows`);
    
    rows.forEach((row, index) => {
      if (row.querySelector('th')) return; // Skip header
      
      const channelData = extractChannelData(row);
      if (!channelData.displayName) return;
      
      channelsToClassify.push({
        name: channelData.displayName,
        url: channelData.placementId
      });
      
      rowData.push({
        row: row,
        channel: channelData.displayName,
        placementId: channelData.placementId,
        spend: extractSpend(row)
      });
    });
    
    console.log(`[PMax] Collected ${channelsToClassify.length} channels to classify`);
    
    if (channelsToClassify.length === 0) {
      return { success: true, tier1: [], tier2: [], counts: { tier1: 0, tier2: 0 } };
    }
    
    // Step 2: Send bulk classification request to background script (which sends to proxy)
    const classificationResult = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'classifyChannels',
        channels: channelsToClassify,
        licenseKey: licenseKey
      }, (response) => {
        resolve(response || { error: 'No response from background' });
      });
    });
    
    if (classificationResult.error) {
      console.error('[PMax] Classification error:', classificationResult.error);
      return { error: classificationResult.error };
    }
    
    // Step 3: Build lookup map from results
    const classifications = classificationResult.results || [];
    classifications.forEach(c => {
      cachedClassifications[c.name.toLowerCase()] = c;
    });
    
    console.log(`[PMax] Received ${classifications.length} classifications`);
    
    // Step 4: Apply classifications to rows
    rowData.forEach(({ row, channel, placementId, spend }) => {
      const normalizedChannel = channel.toLowerCase();
      const classification = cachedClassifications[normalizedChannel];
      
      if (!classification || classification.tier === 'none') {
        return;
      }
      
      const placement = { 
        channel: channel,
        placementId: placementId,
        spend, 
        row,
        category: classification.category,
        keyword: classification.keyword
      };
      
      if (classification.tier === 'tier1') {
        tier1Placements.push(placement);
        totalSpend.tier1 += spend;
      } else if (classification.tier === 'tier2') {
        tier2Placements.push(placement);
        totalSpend.tier2 += spend;
      }
      
      // Track category totals
      const cat = classification.category;
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { count: 0, spend: 0, tier1: 0, tier2: 0 };
      }
      categoryTotals[cat].count++;
      categoryTotals[cat].spend += spend;
      if (classification.tier === 'tier1') {
        categoryTotals[cat].tier1++;
      } else {
        categoryTotals[cat].tier2++;
      }
      
      highlightRow(row, classification);
    });
    
    console.log(`[PMax] Scan complete: ${tier1Placements.length} tier1, ${tier2Placements.length} tier2`);
    
    return {
      success: true,
      tier1: tier1Placements.map(p => ({ 
        channel: p.channel, 
        placementId: p.placementId, 
        spend: p.spend, 
        category: p.category 
      })),
      tier2: tier2Placements.map(p => ({ 
        channel: p.channel, 
        placementId: p.placementId, 
        spend: p.spend, 
        category: p.category, 
        keyword: p.keyword 
      })),
      totalSpend,
      categoryTotals,
      counts: { 
        tier1: tier1Placements.length, 
        tier2: tier2Placements.length 
      }
    };
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[PMax] Message received:', request.action);
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        sendResponse(result);
      }).catch(err => {
        sendResponse({ error: err.message });
      });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      sendResponse({ 
        success: true, 
        message: 'Use PMax Sentry Dashboard to exclude channels' 
      });
      return false;
    }
    
    if (request.action === 'toggleSuspected') {
      highlightSuspected = request.enabled;
      sendResponse({ success: true });
      return false;
    }
    
    if (request.action === 'toggleHighlight') {
      const channel = request.channel;
      const show = request.show;
      
      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach(row => {
        const data = extractChannelData(row);
        if (data.displayName === channel) {
          if (show) {
            const normalized = channel.toLowerCase();
            const classification = cachedClassifications[normalized];
            if (classification && (classification.tier === 'tier1' || classification.tier === 'tier2')) {
              highlightRow(row, classification);
            }
          } else {
            row.style.backgroundColor = '';
            row.style.borderLeft = '';
            row.style.opacity = '0.5';
          }
        }
      });
      
      sendResponse({ success: true });
      return false;
    }
    
    if (request.action === 'reloadData') {
      initialize().then(() => {
        sendResponse({ success: true, licensed: isLicensed });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }
    
    if (request.action === 'markBlocked') {
      const channel = request.channel;
      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach(row => {
        const data = extractChannelData(row);
        if (data.displayName === channel) {
          row.style.backgroundColor = '#e5e7eb';
          row.style.borderLeft = '4px solid #9ca3af';
          row.style.opacity = '0.6';
          row.dataset.sentryBlocked = 'true';
        }
      });
      sendResponse({ success: true });
      return false;
    }
    
    if (request.action === 'ping') {
      sendResponse({ 
        pong: true, 
        licensed: isLicensed, 
        version: '3.0',
        dataLoaded: true,
        channelCount: 51448
      });
      return false;
    }
    
    sendResponse({ error: 'Unknown action' });
    return false;
  });
  
  // Start
  initialize();
  
})();