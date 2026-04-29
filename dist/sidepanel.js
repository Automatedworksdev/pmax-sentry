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
        
        // Check if sync is needed and auto-trigger
        chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (syncStatus) => {
          if (syncStatus?.syncStatus !== 'completed') {
            startSyncPolling();
          }
        });
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
    const syncStatus = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
    
    if (stats) {
      if (channelCount) {
        if (syncStatus?.syncStatus === 'in_progress') {
          channelCount.textContent = '...';
          channelCount.classList.add('pulsing');
          // Show progress bar
          const progressEl = document.getElementById('sync-progress');
          if (progressEl) progressEl.classList.remove('hidden');
        } else if (stats.channelCount > 0) {
          channelCount.textContent = stats.channelCount.toLocaleString();
          channelCount.classList.remove('pulsing');
          // Hide progress bar
          const progressEl = document.getElementById('sync-progress');
          if (progressEl) progressEl.classList.add('hidden');
        } else {
          channelCount.textContent = '0';
          channelCount.classList.remove('pulsing');
        }
      }
      if (dataVersion) dataVersion.textContent = stats.version || '2.2';
      if (lastSync) {
        if (syncStatus?.syncStatus === 'completed' && stats.syncedAt) {
          const date = new Date(stats.syncedAt);
          lastSync.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          lastSync.classList.remove('sync-pending', 'sync-error');
        } else if (syncStatus?.syncStatus === 'failed') {
          lastSync.textContent = 'Failed';
          lastSync.classList.add('sync-error');
          lastSync.classList.remove('sync-pending');
        } else if (syncStatus?.syncStatus === 'in_progress') {
          lastSync.textContent = 'Syncing...';
          lastSync.classList.add('sync-pending');
          lastSync.classList.remove('sync-error');
        } else {
          lastSync.textContent = '--';
          lastSync.classList.remove('sync-pending', 'sync-error');
        }
      }
    }
  }
  
  function showSyncProgress() {
    const progressEl = document.getElementById('sync-progress');
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    const channelsLabel = document.getElementById('channels-label');
    
    if (progressEl) {
      progressEl.classList.remove('hidden');
      channelsLabel.textContent = 'Downloading...';
    }
  }
  
  function hideSyncProgress() {
    const progressEl = document.getElementById('sync-progress');
    const channelsLabel = document.getElementById('channels-label');
    
    if (progressEl) {
      progressEl.classList.add('hidden');
      channelsLabel.textContent = 'Channels';
    }
  }
  
  function updateProgress(percent) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) {
      progressFill.style.width = percent + '%';
    }
    if (progressText) {
      progressText.textContent = `Downloading Database... ${percent}%`;
    }
  }
  
  // Sync button click handler (now in header)
  const refreshBtn = document.getElementById('sync-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const refreshIcon = refreshBtn.querySelector('.refresh-icon');
      
      refreshBtn.disabled = true;
      if (refreshIcon) refreshIcon.classList.add('spinning');
      if (statusEl) statusEl.textContent = 'Syncing...';
      
      // Show progress in channels box
      const channelCount = document.getElementById('channel-count');
      const progressEl = document.getElementById('sync-progress');
      
      if (channelCount) {
        channelCount.textContent = '...';
        channelCount.classList.add('pulsing');
      }
      if (progressEl) {
        progressEl.classList.remove('hidden');
      }
      
      await chrome.runtime.sendMessage({ action: 'forceRefresh' });
      
      // Check result and update UI
      setTimeout(async () => {
        const result = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
        const stats = await chrome.runtime.sendMessage({ action: 'getStats' });
        
        refreshBtn.disabled = false;
        if (refreshIcon) refreshIcon.classList.remove('spinning');
        
        if (result?.syncStatus === 'completed' && stats?.channelCount > 0) {
          if (statusEl) statusEl.textContent = 'Ready to scan';
          if (progressEl) progressEl.classList.add('hidden');
          if (channelCount) channelCount.classList.remove('pulsing');
        } else {
          if (statusEl) statusEl.textContent = 'Sync failed';
        }
        
        await loadStats();
      }, 2000);
    });
  }
  
  // Poll sync status while in progress
  let syncPollInterval = null;
  function startSyncPolling() {
    if (syncPollInterval) clearInterval(syncPollInterval);
    
    syncPollInterval = setInterval(async () => {
      const result = await chrome.runtime.sendMessage({ action: 'getSyncStatus' });
      
      if (result?.syncStatus === 'in_progress') {
        updateProgress(result.syncProgress || 0);
      } else if (result?.syncStatus === 'completed') {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
        await loadStats();
        hideSyncProgress();
      } else if (result?.syncStatus === 'failed') {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
        const progressText = document.getElementById('progress-text');
        if (progressText) progressText.textContent = 'Sync failed - Click retry';
        progressText.style.color = '#ef4444';
      }
    }, 1500);
  }
  
  // Make sync text clickable (secondary method)
  if (lastSync) {
    lastSync.style.cursor = 'pointer';
    lastSync.title = 'Click to refresh data';
    lastSync.addEventListener('click', async () => {
      document.getElementById('sync-btn')?.click();
    });
  }
  
  // License validation - OPTIMIZED for instant feedback
  if (validateBtn) {
    validateBtn.addEventListener('click', async () => {
      const key = licenseInput.value.trim();
      if (!key) {
        if (licenseStatus) licenseStatus.textContent = 'Enter a license key';
        return;
      }
      
      // Show loading state
      validateBtn.disabled = true;
      validateBtn.innerHTML = '<span class="spinner"></span> Verifying...';
      if (licenseStatus) licenseStatus.textContent = '';
      
      const startTime = Date.now();
      
      try {
        const response = await chrome.runtime.sendMessage({ action: 'validateLicense', key });
        
        const elapsed = Date.now() - startTime;
        console.log(`[PMax] License validation took ${elapsed}ms`);
        
        if (response?.valid) {
          // INSTANT SUCCESS - show dashboard immediately
          validateBtn.innerHTML = '✓ Activated!';
          if (licenseStatus) {
            licenseStatus.innerHTML = `
              <div style="color: #10b981; font-weight: 500;">
                ✓ License Active
                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                  Initial sync in progress...
                </div>
              </div>
            `;
          }
          
          // Show dashboard immediately (don't wait for sync)
          setTimeout(() => {
            showDashboard();
            loadStats();
            startSyncPolling(); // Start polling for sync progress
          }, 300);
          
        } else {
          validateBtn.disabled = false;
          validateBtn.textContent = 'Activate License';
          if (licenseStatus) {
            licenseStatus.innerHTML = `<span style="color: #ef4444;">${response?.error || 'Invalid key'}</span>`;
          }
        }
      } catch (error) {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Activate License';
        if (licenseStatus) {
          licenseStatus.innerHTML = `<span style="color: #ef4444;">Error: ${error.message}</span>`;
        }
      }
    });
  }
  
  // Show sync progress in dashboard
  async function startSyncProgressIndicator() {
    const syncIndicator = document.getElementById('sync-indicator') || createSyncIndicator();
    
    // Check sync status every 2 seconds
    const checkInterval = setInterval(async () => {
      const result = await chrome.storage.local.get(['syncStatus', 'syncProgress', 'pmaxData']);
      
      if (result.syncStatus === 'completed' || result.pmaxData?.channels?.length > 0) {
        syncIndicator.innerHTML = `<span style="color: #10b981;">✓ ${result.pmaxData?.channels?.length?.toLocaleString() || ''} channels loaded</span>`;
        syncIndicator.classList.add('sync-complete');
        clearInterval(checkInterval);
        loadStats(); // Refresh stats
      } else if (result.syncStatus === 'in_progress') {
        syncIndicator.innerHTML = `<span class="spinner-small"></span> Syncing ${result.syncProgress || 0}%...`;
      } else if (result.syncStatus === 'failed') {
        syncIndicator.innerHTML = `<span style="color: #ef4444;">Sync failed. <a href="#" id="retry-sync">Retry</a></span>`;
        clearInterval(checkInterval);
        
        document.getElementById('retry-sync')?.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.runtime.sendMessage({ action: 'forceRefresh' });
          startSyncProgressIndicator();
        });
      }
    }, 2000);
  }
  
  function createSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'sync-indicator';
    indicator.innerHTML = '<span class="spinner-small"></span> Initial sync in progress...';
    
    // Add to dashboard header
    const header = document.querySelector('.dashboard-header');
    if (header) {
      header.appendChild(indicator);
    }
    
    return indicator;
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