document.addEventListener('DOMContentLoaded', () => {
  console.log('[PMax Sentry] Sidepanel loaded');
  
  // Get elements
  const licenseView = document.getElementById('license-view');
  const dashboardView = document.getElementById('dashboard-view');
  const licenseInput = document.getElementById('license-key');
  const validateBtn = document.getElementById('validate-license-btn');
  const licenseStatus = document.getElementById('license-status');
  const scanBtn = document.getElementById('scan-btn');
  const excludeBtn = document.getElementById('exclude-btn');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const tier1List = document.getElementById('tier1-list');
  const tier2List = document.getElementById('tier2-list');
  const tier1Count = document.getElementById('tier1-count');
  const tier2Count = document.getElementById('tier2-count');
  const tier1Spend = document.getElementById('tier1-spend');
  const tier2Spend = document.getElementById('tier2-spend');
  const channelCount = document.getElementById('channel-count');
  const dataVersion = document.getElementById('data-version');
  const lastSync = document.getElementById('last-sync');
  const categoryBreakdown = document.getElementById('category-breakdown');
  
  let scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 }, categoryTotals: {} };
  
  // Check license status on load
  checkLicenseStatus();
  
  function checkLicenseStatus() {
    chrome.runtime.sendMessage({ action: 'getLicenseStatus' }, (response) => {
      if (response?.valid) {
        showDashboard();
        loadStats();
        // AUTO-SYNC: If data is empty, trigger sync immediately
        autoSyncIfNeeded();
      } else {
        showLicenseView();
      }
    });
  }
  
  // Auto-sync if data is missing
  async function autoSyncIfNeeded() {
    const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (!stats.channelCount) {
      console.log('[PMax] No data found, auto-syncing...');
      if (statusEl) statusEl.textContent = 'Syncing data...';
      await chrome.runtime.sendMessage({ action: 'forceRefresh' });
      await loadStats();
      if (statusEl) statusEl.textContent = 'Ready to scan';
    }
  }
  
  function showLicenseView() {
    licenseView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
  
  function showDashboard() {
    licenseView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
  
  async function loadStats() {
    const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (stats) {
      if (channelCount) channelCount.textContent = stats.channelCount || '0';
      if (dataVersion) dataVersion.textContent = stats.version || '2.2';
      if (lastSync) {
        if (stats.syncedAt) {
          const date = new Date(stats.syncedAt);
          lastSync.textContent = date.toLocaleTimeString();
        } else {
          lastSync.textContent = 'Never';
        }
      }
    }
  }
  
  // Make sync text clickable
  if (lastSync) {
    lastSync.style.cursor = 'pointer';
    lastSync.title = 'Click to refresh data';
    lastSync.addEventListener('click', async () => {
      if (statusEl) statusEl.textContent = 'Syncing...';
      lastSync.textContent = '...';
      await chrome.runtime.sendMessage({ action: 'forceRefresh' });
      await loadStats();
      if (statusEl) statusEl.textContent = 'Data refreshed!';
      setTimeout(() => {
        if (statusEl) statusEl.textContent = 'Ready to scan';
      }, 2000);
    });
  }
  
  // License validation
  if (validateBtn) {
    validateBtn.addEventListener('click', async () => {
      const key = licenseInput.value.trim();
      if (!key) {
        if (licenseStatus) licenseStatus.textContent = 'Enter a license key';
        return;
      }
      
      validateBtn.disabled = true;
      if (licenseStatus) licenseStatus.textContent = 'Verifying & syncing...';
      
      const response = await chrome.runtime.sendMessage({ action: 'validateLicense', key });
      
      validateBtn.disabled = false;
      
      if (response?.valid) {
        if (licenseStatus) licenseStatus.textContent = '✓ Activated & synced!';
        setTimeout(() => {
          showDashboard();
          loadStats();
        }, 1000);
      } else {
        if (licenseStatus) licenseStatus.textContent = response?.error || 'Invalid key';
      }
    });
  }
  
  // Scan placements - with data check
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      scanBtn.disabled = true;
      
      // First check if data is loaded
      const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
      
      if (!stats.channelCount) {
        // Data not loaded, sync first
        if (statusEl) statusEl.textContent = 'Syncing data...';
        scanBtn.textContent = 'Syncing...';
        
        await chrome.runtime.sendMessage({ action: 'forceRefresh' });
        await loadStats();
        
        // Check again after sync
        const stats2 = await chrome.runtime.sendMessage({ action: 'getStats' });
        if (!stats2.channelCount) {
          scanBtn.disabled = false;
          if (statusEl) statusEl.textContent = 'Error: Data sync failed';
          scanBtn.textContent = 'Scan Placements';
          return;
        }
      }
      
      if (statusEl) statusEl.textContent = 'Scanning...';
      scanBtn.textContent = 'Scanning...';
      
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) throw new Error('No tab');
        
        // Try to scan
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' });
        
        scanBtn.disabled = false;
        scanBtn.textContent = 'Scan Placements';
        
        if (!response) {
          if (statusEl) statusEl.textContent = 'Error: Refresh page first';
          return;
        }
        
        if (response.error) {
          if (statusEl) statusEl.textContent = response.error;
          return;
        }
        
        if (response.needsLicense) {
          showLicenseView();
          return;
        }
        
        scanResults = response;
        updateDisplay();
        
        const total = (response.counts?.tier1 || 0) + (response.counts?.tier2 || 0);
        if (statusEl) statusEl.textContent = total > 0 ? `Found ${total} placements` : 'No waste found';
        
      } catch (err) {
        scanBtn.disabled = false;
        scanBtn.textContent = 'Scan Placements';
        if (statusEl) statusEl.textContent = 'Error: ' + err.message;
      }
    });
  }
  
  // Exclude
  if (excludeBtn) {
    excludeBtn.addEventListener('click', () => {
      excludeBtn.disabled = true;
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'performExclusion' }, (response) => {
            excludeBtn.disabled = false;
            if (response?.success) {
              if (statusEl) statusEl.textContent = `Excluded ${response.excludedCount}`;
            }
          });
        }
      });
    });
  }
  
  // Save
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      let csv = 'Tier,Channel,Spend,Category\n';
      scanResults.tier1?.forEach(p => csv += `Confirmed,${p.channel},${p.spend.toFixed(2)},${p.category}\n`);
      scanResults.tier2?.forEach(p => csv += `Suspected,${p.channel},${p.spend.toFixed(2)},${p.category}\n`);
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pmax-sentry-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    });
  }
  
  function updateDisplay() {
    if (tier1Count) tier1Count.textContent = scanResults.counts?.tier1 || 0;
    if (tier2Count) tier2Count.textContent = scanResults.counts?.tier2 || 0;
    if (tier1Spend) tier1Spend.textContent = `£${(scanResults.totalSpend?.tier1 || 0).toFixed(2)}`;
    if (tier2Spend) tier2Spend.textContent = `£${(scanResults.totalSpend?.tier2 || 0).toFixed(2)}`;
    
    // Tier 1 list
    if (tier1List) {
      tier1List.innerHTML = '';
      scanResults.tier1?.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.channel}</span><span>£${p.spend.toFixed(2)}</span>`;
        tier1List.appendChild(li);
      });
      if (!scanResults.tier1?.length) {
        tier1List.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">No confirmed waste found</li>';
      }
    }
    
    // Tier 2 list
    if (tier2List) {
      tier2List.innerHTML = '';
      scanResults.tier2?.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${p.channel}</span><span>£${p.spend.toFixed(2)}</span>`;
        tier2List.appendChild(li);
      });
      if (!scanResults.tier2?.length) {
        tier2List.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">No suspected waste found</li>';
      }
    }
    
    // Category breakdown
    if (categoryBreakdown) {
      let html = '<div style="padding:16px;">';
      const cats = scanResults.categoryTotals || {};
      Object.keys(cats).sort((a, b) => cats[b].spend - cats[a].spend).forEach(cat => {
        html += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">`;
        html += `<span>${cat}</span><span>${cats[cat].count} = £${cats[cat].spend.toFixed(2)}</span>`;
        html += `</div>`;
      });
      if (!Object.keys(cats).length) {
        html += '<p style="color:#999;text-align:center;">No category data</p>';
      }
      html += '</div>';
      categoryBreakdown.innerHTML = html;
    }
    
    // Enable/disable buttons
    const total = (scanResults.counts?.tier1 || 0) + (scanResults.counts?.tier2 || 0);
    if (excludeBtn) excludeBtn.disabled = total === 0;
    if (saveBtn) saveBtn.disabled = total === 0;
  }
});