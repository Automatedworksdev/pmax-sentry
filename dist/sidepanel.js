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
  chrome.runtime.sendMessage({ action: 'getLicenseStatus' }, (response) => {
    if (response?.valid) {
      showDashboard();
      loadStats();
    } else {
      showLicenseView();
    }
  });
  
  function showLicenseView() {
    licenseView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
  
  function showDashboard() {
    licenseView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
  
  function loadStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (stats) => {
      if (stats) {
        if (channelCount) channelCount.textContent = stats.channelCount || '0';
        if (dataVersion) dataVersion.textContent = stats.version || '2.2';
        if (lastSync) lastSync.textContent = stats.syncedAt ? 'Just now' : 'Never';
      }
    });
  }
  
  // License validation
  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      const key = licenseInput.value.trim();
      if (!key) {
        if (licenseStatus) licenseStatus.textContent = 'Enter a license key';
        return;
      }
      
      validateBtn.disabled = true;
      if (licenseStatus) licenseStatus.textContent = 'Verifying...';
      
      chrome.runtime.sendMessage({ action: 'validateLicense', key }, (response) => {
        validateBtn.disabled = false;
        
        if (response?.valid) {
          if (licenseStatus) licenseStatus.textContent = '✓ Activated!';
          setTimeout(() => {
            showDashboard();
            loadStats();
          }, 1000);
        } else {
          if (licenseStatus) licenseStatus.textContent = response?.error || 'Invalid key';
        }
      });
    });
  }
  
  // Scan placements
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      scanBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Scanning...';
      
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) throw new Error('No tab');
        
        // Try to scan
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' });
        
        scanBtn.disabled = false;
        
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
        if (statusEl) statusEl.textContent = `Found ${total} placements`;
        
      } catch (err) {
        scanBtn.disabled = false;
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
      Object.keys(cats).forEach(cat => {
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