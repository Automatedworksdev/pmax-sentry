document.addEventListener('DOMContentLoaded', () => {
  // Views
  const licenseView = document.getElementById('license-view');
  const dashboardView = document.getElementById('dashboard-view');
  
  // License
  const licenseInput = document.getElementById('license-key');
  const validateBtn = document.getElementById('validate-license-btn');
  const licenseStatus = document.getElementById('license-status');
  
  // Dashboard
  const scanBtn = document.getElementById('scan-btn');
  const excludeBtn = document.getElementById('exclude-btn');
  const saveBtn = document.getElementById('save-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const toggleSuspected = document.getElementById('toggle-suspected');
  
  // Stats
  const tier1Count = document.getElementById('tier1-count');
  const tier2Count = document.getElementById('tier2-count');
  const tier1Spend = document.getElementById('tier1-spend');
  const tier2Spend = document.getElementById('tier2-spend');
  
  // Lists
  const tier1List = document.getElementById('tier1-list');
  const tier2List = document.getElementById('tier2-list');
  const categoryBreakdown = document.getElementById('category-breakdown');
  
  // Toast
  const toast = document.getElementById('toast');
  
  // State
  let scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 }, categoryTotals: {} };
  let currentLicense = null;
  
  // Init
  checkLicenseStatus();
  
  function checkLicenseStatus() {
    chrome.runtime.sendMessage({ action: 'getLicenseStatus' }, (response) => {
      if (response?.valid) {
        currentLicense = response;
        showDashboard();
        loadStats();
      } else {
        showLicenseView();
      }
    });
  }
  
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
        document.getElementById('data-version').textContent = stats.version || '2.1';
        document.getElementById('channel-count').textContent = stats.channelCount || 0;
        document.getElementById('last-sync').textContent = stats.syncedAt ? 
          new Date(stats.syncedAt).toLocaleTimeString() : 'Never';
      }
    });
  }
  
  // License validation
  validateBtn.addEventListener('click', () => {
    const key = licenseInput.value.trim();
    if (!key) return showLicenseError('Enter a license key');
    
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    
    chrome.runtime.sendMessage({ action: 'validateLicense', key }, (response) => {
      validateBtn.disabled = false;
      validateBtn.textContent = 'Activate';
      
      if (response?.valid) {
        showLicenseSuccess(response);
        setTimeout(() => {
          showDashboard();
          loadStats();
        }, 1500);
      } else {
        showLicenseError(response?.error || 'Invalid key');
      }
    });
  });
  
  function showLicenseError(msg) {
    licenseStatus.innerHTML = `<span style="color:#dc2626">❌ ${msg}</span>`;
  }
  
  function showLicenseSuccess(res) {
    licenseStatus.innerHTML = `<span style="color:#16a34a">✓ Activated! Uses: ${res.uses}/${res.maxUses}</span>`;
  }
  
  // Refresh data
  refreshBtn?.addEventListener('click', () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Syncing...';
    
    chrome.runtime.sendMessage({ action: 'forceRefresh' }, () => {
      setTimeout(() => {
        loadStats();
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Refresh Data';
        showToast('Data refreshed!');
      }, 1000);
    });
  });
  
  // Scan
  scanBtn.addEventListener('click', async () => {
    const btnText = scanBtn.querySelector('.btn-text');
    const spinner = scanBtn.querySelector('.spinner');
    const statusEl = document.getElementById('status');
    
    btnText.textContent = 'Scanning...';
    spinner.classList.remove('hidden');
    scanBtn.disabled = true;
    statusEl.textContent = 'Scanning...';
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) throw new Error('No active tab');
      
      // Send with retry
      let response = await sendMessage(tabs[0].id, { action: 'scanPlacements' });
      
      if (!response) {
        // Retry after 500ms
        await new Promise(r => setTimeout(r, 500));
        response = await sendMessage(tabs[0].id, { action: 'scanPlacements' });
      }
      
      btnText.textContent = 'Scan Placements';
      spinner.classList.add('hidden');
      scanBtn.disabled = false;
      
      if (!response) {
        statusEl.textContent = 'Error: Refresh page';
        statusEl.classList.add('error');
        return;
      }
      
      if (response.needsLicense) {
        showLicenseView();
        return;
      }
      
      if (!response.success) {
        statusEl.textContent = response.error || 'Scan failed';
        statusEl.classList.add('error');
        return;
      }
      
      scanResults = response;
      updateDisplay();
      
      const total = (response.counts?.tier1 || 0) + (response.counts?.tier2 || 0);
      statusEl.textContent = `Found ${total} placements`;
      statusEl.classList.add('success');
      
      showToast(`Found ${response.counts?.tier1 || 0} confirmed, ${response.counts?.tier2 || 0} suspected`);
      
    } catch (err) {
      btnText.textContent = 'Scan Placements';
      spinner.classList.add('hidden');
      scanBtn.disabled = false;
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.classList.add('error');
    }
  });
  
  function sendMessage(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        resolve(chrome.runtime.lastError ? null : response);
      });
    });
  }
  
  // Exclude
  excludeBtn.addEventListener('click', () => {
    const total = scanResults.counts?.tier1 + (toggleSuspected.checked ? scanResults.counts?.tier2 : 0);
    if (total === 0) return;
    
    excludeBtn.textContent = 'Excluding...';
    excludeBtn.disabled = true;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'performExclusion' }, (response) => {
        if (response?.success) {
          excludeBtn.textContent = `Excluded ${response.excludedCount} ✓`;
          showToast(`Excluded ${response.excludedCount} placements`);
        } else {
          excludeBtn.textContent = 'Exclude All';
          excludeBtn.disabled = false;
        }
      });
    });
  });
  
  // Save report
  saveBtn.addEventListener('click', () => {
    const csv = generateCSV(scanResults);
    const filename = `pmax-sentry-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
    showToast('Report saved!');
  });
  
  // Toggle suspected
  toggleSuspected.addEventListener('change', (e) => {
    const tier2List = document.getElementById('tier2-list');
    if (tier2List) {
      tier2List.parentElement.classList.toggle('hidden', !e.target.checked);
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSuspected', enabled: e.target.checked }, () => {});
      }
    });
  });
  
  // Report button (community) - clicked in sidepanel
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('report-btn')) {
      const channel = e.target.dataset.channel;
      showReportModal(channel);
    }
  });
  
  // Handle openReportModal from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openReportModal') {
      showReportModal(request.channel);
      sendResponse({ success: true });
    }
    return true;
  });
  
  function showReportModal(channel) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;">
        <div style="background:white;padding:24px;border-radius:12px;width:300px;">
          <h3 style="margin:0 0 16px;font-size:16px;">Report Channel</h3>
          <p style="font-size:12px;color:#5f6368;margin-bottom:12px;">${channel}</p>
          <select id="report-category" style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #ddd;border-radius:4px;">
            <option value="Kids">Kids</option>
            <option value="Gaming">Gaming</option>
            <option value="MFA">MFA (Mobile Rewards)</option>
            <option value="ASMR">ASMR</option>
            <option value="News">News</option>
            <option value="Music">Music</option>
            <option value="General">General</option>
          </select>
          <textarea id="report-reason" placeholder="Why is this placement low quality?" style="width:100%;padding:8px;margin-bottom:12px;border:1px solid #ddd;border-radius:4px;height:60px;"></textarea>
          <div style="display:flex;gap:8px;">
            <button id="cancel-report" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;background:white;cursor:pointer;">Cancel</button>
            <button id="submit-report" style="flex:1;padding:8px;background:#1a73e8;color:white;border:none;border-radius:4px;cursor:pointer;">Submit</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cancel-report').onclick = () => modal.remove();
    document.getElementById('submit-report').onclick = () => {
      const category = document.getElementById('report-category').value;
      const reason = document.getElementById('report-reason').value;
      
      chrome.runtime.sendMessage({
        action: 'submitReport',
        data: { channelName: channel, category, reason }
      }, (response) => {
        modal.remove();
        if (response?.success) {
          showToast('Report submitted! Thank you.');
        } else {
          showToast('Report failed. Try again.');
        }
      });
    };
  }
  
  // Update display
  function updateDisplay() {
    tier1Count.textContent = scanResults.counts?.tier1 || 0;
    tier2Count.textContent = scanResults.counts?.tier2 || 0;
    tier1Spend.textContent = `£${(scanResults.totalSpend?.tier1 || 0).toFixed(2)}`;
    tier2Spend.textContent = `£${(scanResults.totalSpend?.tier2 || 0).toFixed(2)}`;
    
    // Tier 1 list
    tier1List.innerHTML = '';
    if (!scanResults.tier1?.length) {
      tier1List.innerHTML = '<li class="no-results">No confirmed waste</li>';
    } else {
      scanResults.tier1.forEach(p => {
        const li = document.createElement('li');
        li.className = 'placement-item tier1';
        li.innerHTML = `
          <span class="channel-name">${p.channel}</span>
          <span class="spend">£${p.spend.toFixed(2)}</span>
          <span class="category-tag" style="background:${getCategoryColor(p.category)}">${p.category}</span>
          <button class="report-btn" data-channel="${p.channel}" style="padding:2px 6px;font-size:10px;background:#fee2e2;border:1px solid #dc2626;border-radius:4px;cursor:pointer;">Report</button>
        `;
        tier1List.appendChild(li);
      });
    }
    
    // Tier 2 list
    tier2List.innerHTML = '';
    if (!scanResults.tier2?.length) {
      tier2List.innerHTML = '<li class="no-results">No suspected waste</li>';
    } else {
      scanResults.tier2.forEach(p => {
        const li = document.createElement('li');
        li.className = 'placement-item tier2';
        li.innerHTML = `
          <span class="channel-name">${p.channel}</span>
          <span class="spend">£${p.spend.toFixed(2)}</span>
          <span class="category-tag" style="background:${getCategoryColor(p.category)}">${p.category}</span>
          <button class="report-btn" data-channel="${p.channel}" style="padding:2px 6px;font-size:10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;cursor:pointer;">Report</button>
        `;
        tier2List.appendChild(li);
      });
    }
    
    // Category breakdown
    updateCategoryBreakdown();
  }
  
  function updateCategoryBreakdown() {
    if (!categoryBreakdown) return;
    
    const totals = scanResults.categoryTotals || {};
    
    if (!Object.keys(totals).length) {
      categoryBreakdown.innerHTML = '<p style="color:#5f6368;font-size:12px;">No category data</p>';
      return;
    }
    
    let html = '<table style="width:100%;font-size:12px;">';
    html += '<tr><th>Category</th><th>Count</th><th>Spend</th></tr>';
    
    Object.entries(totals).sort((a, b) => b[1].spend - a[1].spend).forEach(([cat, data]) => {
      html += `<tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getCategoryColor(cat)};margin-right:6px;"></span>${cat}</td>
        <td style="text-align:center">${data.count}</td>
        <td style="text-align:right">£${data.spend.toFixed(2)}</td>
      </tr>`;
    });
    
    html += '</table>';
    categoryBreakdown.innerHTML = html;
  }
  
  function getCategoryColor(category) {
    const colors = {
      'Kids': '#3b82f6',
      'Gaming': '#8b5cf6',
      'MFA': '#ef4444',
      'ASMR': '#10b981',
      'News': '#f59e0b',
      'Music': '#ec4899',
      'General': '#6b7280'
    };
    return colors[category] || colors['General'];
  }
  
  function generateCSV(data) {
    let lines = ['Tier,Channel,Spend,Category,Keyword'];
    data.tier1?.forEach(p => lines.push(`Confirmed,${p.channel},${p.spend.toFixed(2)},${p.category},`));
    data.tier2?.forEach(p => lines.push(`Suspected,${p.channel},${p.spend.toFixed(2)},${p.category},${p.keyword || ''}`));
    
    // Add category summary
    lines.push('');
    lines.push('Category Breakdown');
    lines.push('Category,Count,Spend');
    Object.entries(data.categoryTotals || {}).forEach(([cat, d]) => {
      lines.push(`${cat},${d.count},${d.spend.toFixed(2)}`);
    });
    
    return lines.join('\n');
  }
  
  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  function showToast(message) {
    const toastMsg = document.getElementById('toast-message');
    if (toastMsg) {
      toastMsg.textContent = message;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    }
  }
});