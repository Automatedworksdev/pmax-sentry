document.addEventListener('DOMContentLoaded', () => {
  // Views
  const onboardingView = document.getElementById('onboarding-view');
  const dashboardView = document.getElementById('dashboard-view');
  const getStartedBtn = document.getElementById('get-started-btn');
  
  // Dashboard elements
  const statusEl = document.getElementById('status');
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
  const toastMessage = document.getElementById('toast-message');
  
  // State
  let scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 } };
  let suspectedEnabled = true;
  
  // Check previous scans
  chrome.storage.local.get(['lastScanTime', 'lastResults'], (result) => {
    if (result.lastScanTime) {
      showDashboard();
      if (result.lastResults) {
        scanResults = result.lastResults;
        updateDisplay();
      }
    } else {
      showOnboarding();
    }
  });
  
  function showOnboarding() {
    onboardingView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
  
  function showDashboard() {
    onboardingView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
  
  // Get Started
  getStartedBtn.addEventListener('click', () => {
    showDashboard();
    checkGoogleAdsTab();
  });
  
  function checkGoogleAdsTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (url.includes('ads.google.com')) {
        statusEl.textContent = 'Ready to scan';
        statusEl.classList.add('ready');
      } else {
        statusEl.textContent = 'Navigate to Google Ads → Placements';
        statusEl.classList.add('warning');
      }
    });
  }
  
  // Toggle suspected highlighting
  toggleSuspected.addEventListener('change', (e) => {
    suspectedEnabled = e.target.checked;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleSuspected',
          enabled: suspectedEnabled
        });
      }
    });
    
    // Toggle visibility of Tier 2 section
    document.getElementById('tier2-section').classList.toggle('hidden', !suspectedEnabled);
  });
  
  // Scan button
  scanBtn.addEventListener('click', () => {
    const btnText = scanBtn.querySelector('.btn-text');
    const spinner = scanBtn.querySelector('.spinner');
    
    btnText.textContent = 'Scanning...';
    spinner.classList.remove('hidden');
    scanBtn.disabled = true;
    statusEl.textContent = 'Scanning placements...';
    statusEl.className = 'status';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' }, (response) => {
        // Reset button
        btnText.textContent = 'Scan Placements';
        spinner.classList.add('hidden');
        scanBtn.disabled = false;
        
        if (chrome.runtime.lastError || !response?.success) {
          statusEl.textContent = 'Error: Refresh page and try again';
          statusEl.classList.add('error');
          return;
        }
        
        scanResults = response;
        
        // Save results
        chrome.storage.local.set({
          lastScanTime: Date.now(),
          lastResults: scanResults
        });
        
        updateDisplay();
        updateButtonStates();
        
        statusEl.textContent = `Found ${response.counts.tier1} confirmed, ${response.counts.tier2} suspected`;
        statusEl.classList.add('success');
        
        showToast(`Scan complete! Found ${response.counts.tier1 + response.counts.tier2} placements.`);
      });
    });
  });
  
  // Exclude button
  excludeBtn.addEventListener('click', () => {
    const totalFound = scanResults.counts?.tier1 + (suspectedEnabled ? scanResults.counts?.tier2 : 0);
    if (totalFound === 0) return;
    
    excludeBtn.textContent = 'Excluding...';
    excludeBtn.disabled = true;
    statusEl.textContent = 'Excluding placements...';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'performExclusion' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          statusEl.textContent = 'Exclusion failed';
          statusEl.classList.add('error');
          excludeBtn.textContent = 'Exclude All';
          excludeBtn.disabled = false;
          return;
        }
        
        statusEl.textContent = `Excluded ${response.excludedCount} placements`;
        statusEl.classList.add('success');
        excludeBtn.textContent = 'Excluded ✓';
        
        showToast(`Success! Excluded ${response.excludedCount} placements.`);
      });
    });
  });
  
  // Save report
  saveBtn.addEventListener('click', () => {
    const totalPlacements = [...scanResults.tier1, ...scanResults.tier2];
    if (totalPlacements.length === 0) return;
    
    const csv = generateCSV(scanResults);
    const filename = `pmax-sentry-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
    
    showToast('Report saved to Downloads!');
  });
  
  function updateDisplay() {
    // Update counters
    tier1CountEl.textContent = scanResults.counts?.tier1 || 0;
    tier2CountEl.textContent = scanResults.counts?.tier2 || 0;
    tier1SpendEl.textContent = `£${(scanResults.totalSpend?.tier1 || 0).toFixed(2)}`;
    tier2SpendEl.textContent = `£${(scanResults.totalSpend?.tier2 || 0).toFixed(2)}`;
    
    // Update Tier 1 list
    tier1List.innerHTML = '';
    if (scanResults.tier1?.length === 0) {
      tier1List.innerHTML = '<li class="no-results">No confirmed waste found</li>';
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
    
    // Update Tier 2 list
    tier2List.innerHTML = '';
    if (scanResults.tier2?.length === 0) {
      tier2List.innerHTML = '<li class="no-results">No suspected waste found</li>';
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
    const total = (scanResults.counts?.tier1 || 0) + (suspectedEnabled ? (scanResults.counts?.tier2 || 0) : 0);
    excludeBtn.disabled = total === 0;
    saveBtn.disabled = total === 0;
  }
  
  function generateCSV(data) {
    const lines = ['Tier,Channel,Spend (£),Keyword/Type'];
    
    data.tier1.forEach(p => {
      lines.push(`Confirmed,${p.channel},${p.spend.toFixed(2)},Tier 1`);
    });
    
    data.tier2.forEach(p => {
      lines.push(`Suspected,${p.channel},${p.spend.toFixed(2)},${p.keyword || 'Tier 2'}`);
    });
    
    lines.push(`\nTOTAL,Confirmed Waste,£${data.totalSpend?.tier1.toFixed(2) || 0}`);
    lines.push(`TOTAL,Suspected Waste,£${data.totalSpend?.tier2.toFixed(2) || 0}`);
    
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
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }
});