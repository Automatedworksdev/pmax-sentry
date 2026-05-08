// PMax Sentry Content Script v2.2 - Intelligence Engine
// Category tracking, community reporting support

(function() {
  'use strict';
  
  console.log('[PMax Sentry] Content script v2.2 loaded');
  
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
  let channelSet = new Set();
  let categoryMap = {}; // channel -> category
  let suspectedKeywords = [];
  let dataLoaded = false;
  let highlightSuspected = true;
  
  // Results
  let tier1Placements = [];
  let tier2Placements = [];
  let totalSpend = { tier1: 0, tier2: 0 };
  let categoryTotals = {}; // category -> { count, spend }
  
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
    'General': '#6b7280'
  };
  
  // Initialize with retry
  async function initialize() {
    console.log('[PMax] Initializing content script...');
    
    // Try to load data multiple times
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await chrome.storage.local.get([
        'licensed', 
        'pmaxData', 
        'suspectedKeywords'
      ]);
      
      console.log('[PMax] Storage data (attempt ' + attempt + '):', {
        licensed: result.licensed,
        pmaxDataExists: !!result.pmaxData,
        pmaxDataChannels: result.pmaxData?.channels?.length,
        suspectedKeywords: result.suspectedKeywords?.length
      });
      
      isLicensed = result.licensed === true;
      
      if (isLicensed && result.pmaxData && result.pmaxData.channels?.length > 0) {
        const data = result.pmaxData;
        channelSet = new Set(data.channels || []);
        
        // Build category map
        if (data.categories) {
          Object.entries(data.categories).forEach(([cat, channels]) => {
            channels.forEach(ch => {
              categoryMap[ch] = cat;
            });
          });
        }
        
        suspectedKeywords = result.suspectedKeywords || [];
        dataLoaded = true;
        
        console.log(`[PMax] Loaded ${channelSet.size} channels, ${suspectedKeywords.length} keywords`);
        break; // Success - exit retry loop
      } else {
        console.log('[PMax] No data yet - waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
    
    if (!dataLoaded) {
      console.log('[PMax] Failed to load data after 3 attempts');
    }
    
    injectBadge();
  }
  
  // Badge
  function injectBadge() {
    if (document.getElementById('pmax-sentry-badge')) return;
    
    const badge = document.createElement('div');
    badge.id = 'pmax-sentry-badge';
    badge.innerHTML = `<div style="position:fixed;top:12px;right:12px;background:${isLicensed ? 'rgba(26,115,232,0.9)' : 'rgba(156,163,175,0.9)'};color:white;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:500;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15);">${isLicensed ? '🛡️ Sentry Active' : '🔒 License Required'}</div>`;
    document.body.appendChild(badge);
  }
  
  // Classify channel
  function classifyChannel(channelName) {
    if (!isLicensed || !dataLoaded) {
      return { tier: 'unlicensed' };
    }
    
    const normalized = channelName.toLowerCase().trim();
    
    // Tier 1: Exact match
    if (channelSet.has(normalized)) {
      const category = categoryMap[normalized] || 'General';
      return { tier: 'tier1', category };
    }
    
    // Tier 2: Keyword match
    if (highlightSuspected) {
      for (const keyword of suspectedKeywords) {
        if (normalized.includes(keyword)) {
          // Infer category from keyword
          const category = inferCategory(keyword);
          return { tier: 'tier2', keyword, category };
        }
      }
    }
    
    return { tier: 'none' };
  }
  
  // Infer category from keyword
  function inferCategory(keyword) {
    const kw = keyword.toLowerCase();
    if (['kids', 'children', 'toddler', 'baby', 'nursery', 'cartoon', 'cocomelon', 'peppa', 'paw patrol', 'disney junior', 'nick jr', 'baby shark'].includes(kw)) {
      return 'Kids';
    }
    if (['gaming', 'gameplay', 'lets play', 'gamer', 'esports', 'twitch', 'streamer'].includes(kw)) {
      return 'Gaming';
    }
    if (['mobile reward', 'app reward', 'offer wall', 'get paid', 'earn money', 'cash app'].includes(kw)) {
      return 'MFA';
    }
    if (['asmr', 'sleep sounds', 'relaxation', 'meditation', 'white noise', 'rain sounds'].includes(kw)) {
      return 'ASMR';
    }
    if (['breaking news', 'live news', '24/7 news', 'news live'].includes(kw)) {
      return 'News';
    }
    if (['music playlist', 'lyrics video', 'top hits', 'pop songs', 'music video'].includes(kw)) {
      return 'Music';
    }
    return 'General';
  }
  
  // Extract data
  function extractChannelName(row) {
    const cells = row.querySelectorAll('td');
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2 && !text.match(/^[\d,]+$/)) {
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
  
  // Highlight row with category color
  function highlightRow(row, classification) {
    const colors = classification.tier === 'tier1' ? COLORS.tier1 : COLORS.tier2;
    const catColor = CATEGORY_COLORS[classification.category] || CATEGORY_COLORS['General'];
    
    row.style.backgroundColor = colors.bg;
    row.style.borderLeft = `4px solid ${colors.border}`;
    row.dataset.sentryTier = classification.tier;
    row.dataset.sentryCategory = classification.category;
    
    // Add category badge to second cell
    const cells = row.querySelectorAll('td');
    const nameCell = cells[1]; // Second cell is usually the name
    if (nameCell && !nameCell.querySelector('.sentry-cat-badge')) {
      const badge = document.createElement('span');
      badge.className = 'sentry-cat-badge';
      badge.style.cssText = `display:inline-block;margin-left:8px;padding:2px 6px;border-radius:4px;font-size:10px;background:${catColor};color:white;font-weight:500;`;
      badge.textContent = classification.category;
      nameCell.appendChild(badge);
    }
  }
  
  // Add Report button to row
  function addReportButton(row, channelName) {
    // Check if button already exists
    if (row.querySelector('.pmax-report-btn')) return;
    
    // Find the last td cell (actions cell)
    const cells = row.querySelectorAll('td');
    const lastCell = cells[cells.length - 1];
    
    if (!lastCell) {
      console.log('[PMax] No cells found for row');
      return;
    }
    
    // Create report button
    const btn = document.createElement('button');
    btn.className = 'pmax-report-btn';
    btn.title = 'Report this channel as low quality';
    btn.innerHTML = '🚩';
    btn.style.cssText = `
      padding: 4px 8px;
      font-size: 12px;
      background: #f1f3f4;
      border: 1px solid #dadce0;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    btn.onmouseover = () => {
      btn.style.background = '#e8eaed';
    };
    btn.onmouseout = () => {
      btn.style.background = '#f1f3f4';
    };
    
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('[PMax] Report clicked for:', channelName);
      // Send message to background to open report modal in sidepanel
      chrome.runtime.sendMessage({
        action: 'openReportModal',
        channel: channelName
      });
    };
    
    lastCell.appendChild(btn);
    console.log('[PMax] Added report button for:', channelName);
  }
  
  // Scan
  async function scanPlacements() {
    console.log('[PMax] Scanning...', { isLicensed, dataLoaded, channelSetSize: channelSet.size });
    
    if (!isLicensed) {
      console.log('[PMax] Not licensed');
      return { error: 'License required', needsLicense: true };
    }
    
    if (!dataLoaded) {
      console.log('[PMax] Data not loaded');
      return { error: 'Data not loaded. Click Sync.', needsRefresh: true };
    }
    
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    categoryTotals = {};
    
    const rows = document.querySelectorAll('table tbody tr, table tr');
    console.log('[PMax] Found', rows.length, 'rows');
    
    rows.forEach((row, index) => {
      if (row.querySelector('th')) return; // Skip header
      
      const name = extractChannelName(row);
      if (!name) {
        console.log('[PMax] No name found for row', index);
        return;
      }
      
      console.log('[PMax] Row', index, 'channel:', name);
      
      const classification = classifyChannel(name);
      console.log('[PMax] Classification:', classification);
      
      if (classification.tier === 'tier1' || classification.tier === 'tier2') {
        const spend = extractSpend(row);
        const placement = { 
          channel: name, 
          spend, 
          row,
          category: classification.category,
          keyword: classification.keyword
        };
        
        if (classification.tier === 'tier1') {
          tier1Placements.push(placement);
          totalSpend.tier1 += spend;
        } else {
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
      }
      
      // Add Report button to ALL rows (including clean ones)
      addReportButton(row, name);
    });
    
    console.log(`[PMax] Scan complete: ${tier1Placements.length} tier1, ${tier2Placements.length} tier2`);
    console.log('[PMax] Category totals:', categoryTotals);
    
    return {
      success: true,
      tier1: tier1Placements.map(p => ({ channel: p.channel, spend: p.spend, category: p.category })),
      tier2: tier2Placements.map(p => ({ channel: p.channel, spend: p.spend, category: p.category, keyword: p.keyword })),
      totalSpend,
      categoryTotals,
      counts: { tier1: tier1Placements.length, tier2: tier2Placements.length }
    };
  }
  
  // Exclude - DEPRECATED: Now managed through dashboard only
  function performExclusion() {
    console.log('[PMax] Exclusion now managed through PMax Sentry Dashboard');
    return { success: true, message: 'Use PMax Sentry Dashboard to exclude channels' };
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[PMax] Message received:', request.action);
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(result => {
        sendResponse(result);
      });
      return true;
    }
    
    if (request.action === 'performExclusion') {
      try {
        const result = performExclusion();
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return false; // Synchronous
    }
    
    if (request.action === 'toggleSuspected') {
      highlightSuspected = request.enabled;
      sendResponse({ success: true });
      return false; // Synchronous
    }
    
    if (request.action === 'reloadData') {
      // Force reload data from storage
      initialize().then(() => {
        sendResponse({ 
          success: true, 
          dataLoaded, 
          channelCount: channelSet.size 
        });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // Asynchronous
    }
    
    if (request.action === 'ping') {
      sendResponse({ 
        pong: true, 
        licensed: isLicensed, 
        dataLoaded,
        channelCount: channelSet.size,
        keywordCount: suspectedKeywords.length
      });
      return false; // Synchronous
    }
    
    // Unknown action
    sendResponse({ error: 'Unknown action' });
    return false;
  });
  
  // Start
  initialize();
  
})();