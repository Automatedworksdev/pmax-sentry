// PMax Sentry Content Script v2.2 - Intelligence Engine
// Category tracking, community reporting support

(function() {
  'use strict';
  
  console.log('[PMax Sentry] Content script v2.2 loaded');
  
  // Safe mode detection
  const isSafeMode = () => {
    const url = window.location.href.toLowerCase();
    return url.includes('cm/placements') || url.includes('placements');
  };
  
  if (!isSafeMode()) return;
  
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
    'General': '#6b7280'
  };
  
  // Initialize
  async function initialize() {
    const result = await chrome.storage.local.get([
      'licensed', 
      'pmaxData', 
      'suspectedKeywords'
    ]);
    
    isLicensed = result.licensed === true;
    
    if (isLicensed && result.pmaxData) {
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
      if (cell.querySelector('input[type="checkbox"]')) continue;
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
    
    // Add category badge
    const badge = document.createElement('span');
    badge.style.cssText = `display:inline-block;margin-left:8px;padding:2px 6px;border-radius:4px;font-size:10px;background:${catColor};color:white;font-weight:500;`;
    badge.textContent = classification.category;
    
    const nameCell = row.querySelector('td:not(:first-child)');
    if (nameCell && !nameCell.querySelector('.sentry-cat-badge')) {
      badge.className = 'sentry-cat-badge';
      nameCell.appendChild(badge);
    }
  }
  
  // Scan
  async function scanPlacements() {
    console.log('[PMax] Scanning...');
    
    if (!isLicensed) {
      return { error: 'License required', needsLicense: true };
    }
    
    if (!dataLoaded) {
      return { error: 'Data not loaded. Refresh page.', needsRefresh: true };
    }
    
    tier1Placements = [];
    tier2Placements = [];
    totalSpend = { tier1: 0, tier2: 0 };
    categoryTotals = {};
    
    const rows = document.querySelectorAll('table tbody tr, table tr');
    
    rows.forEach((row) => {
      if (row.querySelector('th')) return;
      
      const name = extractChannelName(row);
      if (!name) return;
      
      const classification = classifyChannel(name);
      
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
    });
    
    console.log(`[PMax] Found ${tier1Placements.length} tier1, ${tier2Placements.length} tier2`);
    
    return {
      success: true,
      tier1: tier1Placements.map(p => ({ channel: p.channel, spend: p.spend, category: p.category })),
      tier2: tier2Placements.map(p => ({ channel: p.channel, spend: p.spend, category: p.category, keyword: p.keyword })),
      totalSpend,
      categoryTotals,
      counts: { tier1: tier1Placements.length, tier2: tier2Placements.length }
    };
  }
  
  // Exclude
  function performExclusion() {
    const all = [...tier1Placements];
    if (highlightSuspected) all.push(...tier2Placements);
    
    let count = 0;
    all.forEach(p => {
      const checkbox = p.row.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) {
        checkbox.click();
        count++;
      }
    });
    
    return { success: true, excludedCount: count };
  }
  
  // Message handlers
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'scanPlacements') {
      scanPlacements().then(sendResponse);
      return true;
    }
    
    if (request.action === 'performExclusion') {
      const result = performExclusion();
      sendResponse(result);
      return true;
    }
    
    if (request.action === 'toggleSuspected') {
      highlightSuspected = request.enabled;
      sendResponse({ success: true });
      return true;
    }
    
    if (request.action === 'ping') {
      sendResponse({ 
        pong: true, 
        licensed: isLicensed, 
        dataLoaded,
        channelCount: channelSet.size,
        keywordCount: suspectedKeywords.length
      });
      return true;
    }
    
    return true;
  });
  
  // Start
  initialize();
  
})();