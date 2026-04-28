document.addEventListener('DOMContentLoaded', () => {
  // Views
  const onboardingView = document.getElementById('onboarding-view');
  const dashboardView = document.getElementById('dashboard-view');
  const licenseView = document.getElementById('license-view');
  const getStartedBtn = document.getElementById('get-started-btn');
  
  // License elements
  const licenseInput = document.getElementById('license-key');
  const validateBtn = document.getElementById('validate-license-btn');
  const licenseStatus = document.getElementById('license-status');
  const licenseInfo = document.getElementById('license-info');
  
  // Dashboard elements
  const scanBtn = document.getElementById('scan-btn');
  const excludeBtn = document.getElementById('exclude-btn');
  const saveBtn = document.getElementById('save-btn');
  const toggleSuspected = document.getElementById('toggle-suspected');
  
  // Counters
  const tier1CountEl = document.getElementById('tier1-count');
  const tier2CountEl = document.getElementById('tier2-count');
  const tier1SpendEl = document.getElementById('tier1-spend');
  const tier2SpendEl = document.getElementById('tier2-spend');
  
  // Lists
  const tier1List = document.getElementById('tier1-list');
  const tier2List = document.getElementById('tier2-list');
  
  // Toast
  const toast = document.getElementById('toast');
  
  // State
  let scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 } };
  let currentLicense = null;
  
  // Check license on startup
  checkLicenseStatus();
  
  function checkLicenseStatus() {
    chrome.runtime.sendMessage({ action: 'getLicenseStatus' }, (response) => {
      if (response && response.valid) {
        currentLicense = response;
        showDashboard();
        updateLicenseInfo();
        loadPreviousScan();
      } else {
        showLicenseView();
      }
    });
  }
  
  function showLicenseView() {
    licenseView.classList.remove('hidden');
    onboardingView.classList.add('hidden');
    dashboardView.classList.add('hidden');
  }
  
  function showDashboard() {
    licenseView.classList.add('hidden');
    onboardingView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
  
  function showOnboarding() {
    licenseView.classList.add('hidden');
    onboardingView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
  
  // License validation
  validateBtn.addEventListener('click', () => {
    const key = licenseInput.value.trim();
    if (!key) {
      showLicenseError('Please enter a license key');
      return;
    }
    
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validating...';
    licenseStatus.textContent = '';
    
    chrome.runtime.sendMessage({ action: 'validateLicense', key }, (response) => {
      validateBtn.disabled = false;
      validateBtn.textContent = 'Activate';
      
      if (response.valid) {
        currentLicense = response;
        showLicenseSuccess(response);
        setTimeout(() => {
          showDashboard();
          updateLicenseInfo();
        }, 1500);
      } else {
        showLicenseError(response.error || 'Invalid license key');
      }
    });
  });
  
  function showLicenseError(message) {
    licenseStatus.innerHTML = `<span style="color: #dc2626;">❌ ${message}</span>`;
  }
  
  function showLicenseSuccess(response) {
    licenseStatus.innerHTML = `<span style="color: #16a34a;">✓ License activated! Uses: ${response.uses}/${response.maxUses}</span>`;
  }
  
  function updateLicenseInfo() {
    if (!currentLicense) return;
    
    licenseInfo.innerHTML = `
      <div style="
        background: #e6f4ea;
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>✓ Licensed</span>
        <span style="color: #5f6368;">Uses: ${currentLicense.uses || '?'}/${currentLicense.maxUses || '?'}</span>
      </div>
    `;
  }
  
  // Get Started
  getStartedBtn.addEventListener('click', () => {
    showDashboard();
    checkGoogleAdsTab();
  });
  
  function checkGoogleAdsTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const statusEl = document.getElementById('status');
      if (url.includes('ads.google.com')) {
        statusEl.textContent = 'Ready to scan';
        statusEl.classList.add('ready');
      } else {
        statusEl.textContent = 'Navigate to Google Ads → Placements';
        statusEl.classList.add('warning');
      }
    });
  }
  
  // Load previous scan
  function loadPreviousScan() {
    chrome.storage.local.get(['lastScanTime', 'lastResults'], (result) => {
      if (result.lastResults) {
        scanResults = result.lastResults;
        updateDisplay();
        updateButtonStates();
      }
    });
  }
  
  // Toggle suspected
  toggleSuspected.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    document.getElementById('tier2-section').classList.toggle('hidden', !enabled);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleSuspected',
          enabled
        });
      }
    });
  });
  
  // Scan
  scanBtn.addEventListener('click', () => {
    const btnText = scanBtn.querySelector('.btn-text');
    const spinner = scanBtn.querySelector('.spinner');
    const statusEl = document.getElementById('status');
    
    btnText.textContent = 'Scanning...';
    spinner.classList.remove('hidden');
    scanBtn.disabled = true;
    statusEl.textContent = 'Scanning...';
    statusEl.className = 'status';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' }, (response) => {
        btnText.textContent = 'Scan Placements';
        spinner.classList.add('hidden');
        scanBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
          statusEl.textContent = 'Error: Refresh page';
          statusEl.classList.add('error');
          return;
        }
        
        if (response.needsLicense) {
          statusEl.textContent = 'License required';
          statusEl.classList.add('error');
          showLicenseView();
          return;
        }
        
        if (!response.success) {
          statusEl.textContent = response.error || 'Scan failed';
          statusEl.classList.add('error');
          return;
        }
        
        scanResults = response;
        chrome.storage.local.set({
          lastScanTime: Date.now(),
          lastResults: scanResults
        });
        
        updateDisplay();
        updateButtonStates();
        
        const total = (response.counts?.tier1 || 0) + (response.counts?.tier2 || 0);
        statusEl.textContent = `Found ${total} placements`;
        statusEl.classList.add('success');
        
        showToast(`Found ${response.counts?.tier1 || 0} confirmed, ${response.counts?.tier2 || 0} suspected`);
      });
    });
  });
  
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
  
  function updateDisplay() {
    tier1CountEl.textContent = scanResults.counts?.tier1 || 0;
    tier2CountEl.textContent = scanResults.counts?.tier2 || 0;
    tier1SpendEl.textContent = `£${(scanResults.totalSpend?.tier1 || 0).toFixed(2)}`;
    tier2SpendEl.textContent = `£${(scanResults.totalSpend?.tier2 || 0).toFixed(2)}`;
    
    // Tier 1 list
    tier1List.innerHTML = '';
    if (!scanResults.tier1?.length) {
      tier1List.innerHTML = '<li class="no-results">No confirmed waste</li>';
    } else {
      scanResults.tier1.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'placement-item tier1';
        li.style.animationDelay = `${i * 0.03}s`;
        li.innerHTML = `
          <span class="channel-name">${p.channel}</span>
          <span class="spend">£${p.spend.toFixed(2)}</span>
        `;
        tier1List.appendChild(li);
      });
    }
    
    // Tier 2 list
    tier2List.innerHTML = '';
    if (!scanResults.tier2?.length) {
      tier2List.innerHTML = '<li class="no-results">No suspected waste</li>';
    } else {
      scanResults.tier2.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'placement-item tier2';
        li.style.animationDelay = `${i * 0.03}s`;
        li.innerHTML = `
          <span class="channel-name">${p.channel}</span>
          <span class="spend">£${p.spend.toFixed(2)}</span>
          ${p.keyword ? `<span class="keyword-tag">${p.keyword}</span>` : ''}
        `;
        tier2List.appendChild(li);
      });
    }
  }
  
  function updateButtonStates() {
    const total = (scanResults.counts?.tier1 || 0) + (toggleSuspected.checked ? (scanResults.counts?.tier2 || 0) : 0);
    excludeBtn.disabled = total === 0;
    saveBtn.disabled = total === 0;
  }
  
  function generateCSV(data) {
    const lines = ['Tier,Channel,Spend,Keyword'];
    data.tier1?.forEach(p => lines.push(`Confirmed,${p.channel},${p.spend.toFixed(2)},Tier 1`));
    data.tier2?.forEach(p => lines.push(`Suspected,${p.channel},${p.spend.toFixed(2)},${p.keyword || 'Tier 2'}`));
    return lines.join('\n');
  }
  
  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function showToast(message) {
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }
});