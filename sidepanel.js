document.addEventListener('DOMContentLoaded', () => {
  // Views
  const onboardingView = document.getElementById('onboarding-view');
  const dashboardView = document.getElementById('dashboard-view');
  const getStartedBtn = document.getElementById('get-started-btn');
  
  // Dashboard elements
  const statusEl = document.getElementById('status');
  const wasteDisplayEl = document.getElementById('waste-display');
  const scanBtn = document.getElementById('scan-btn');
  const excludeBtn = document.getElementById('exclude-btn');
  const saveBtn = document.getElementById('save-btn');
  const placementList = document.getElementById('placement-list');
  const lastScanTimeEl = document.getElementById('last-scan-time');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  // State
  let currentPlacements = [];
  let currentTotalSpend = 0;
  
  // Check if user has previous scan data
  chrome.storage.local.get(['lastScanTime', 'wastedSpend', 'lastPlacements'], (result) => {
    if (result.lastScanTime) {
      // User has scanned before, show dashboard
      showDashboard();
      loadPreviousData(result);
    } else {
      // First time user, show onboarding
      showOnboarding();
    }
  });
  
  // Get Started button
  getStartedBtn.addEventListener('click', () => {
    showDashboard();
    checkGoogleAdsTab();
  });
  
  function showOnboarding() {
    onboardingView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
  
  function showDashboard() {
    onboardingView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  }
  
  function loadPreviousData(result) {
    if (result.wastedSpend) {
      wasteDisplayEl.textContent = `£${result.wastedSpend.toFixed(2)}`;
      currentTotalSpend = result.wastedSpend;
    }
    if (result.lastPlacements) {
      currentPlacements = result.lastPlacements;
      displayPlacements(currentPlacements);
      updateButtonStates();
    }
    if (result.lastScanTime) {
      const scanDate = new Date(result.lastScanTime);
      lastScanTimeEl.textContent = `Last scanned: ${scanDate.toLocaleString()}`;
    }
  }
  
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
  
  // Scan button handler
  scanBtn.addEventListener('click', () => {
    const btnText = scanBtn.querySelector('.btn-text');
    const spinner = scanBtn.querySelector('.spinner');
    
    // Show loading state
    btnText.textContent = 'Scanning...';
    spinner.classList.remove('hidden');
    scanBtn.disabled = true;
    statusEl.textContent = 'Scanning placements...';
    statusEl.classList.remove('ready', 'warning', 'success', 'error');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' }, (response) => {
          // Reset button
          btnText.textContent = 'Scan Placements';
          spinner.classList.add('hidden');
          scanBtn.disabled = false;
          
          if (chrome.runtime.lastError) {
            statusEl.textContent = 'Error: Refresh page and try again';
            statusEl.classList.add('error');
            return;
          }
          
          if (response?.success) {
            currentPlacements = response.placements;
            currentTotalSpend = response.totalSpend;
            
            displayPlacements(currentPlacements);
            updateWastedSpend(currentTotalSpend);
            saveScanResults(currentPlacements, currentTotalSpend);
            
            statusEl.textContent = `Found ${response.placements.length} junk placements`;
            statusEl.classList.add('success');
            updateButtonStates();
            
            showToast(`Scan complete! Found ${response.placements.length} junk placements.`);
          } else {
            statusEl.textContent = 'Scan failed: ' + (response?.error || 'Unknown error');
            statusEl.classList.add('error');
          }
        });
      }
    });
  });
  
  // Exclude button handler
  excludeBtn.addEventListener('click', () => {
    if (currentPlacements.length === 0) return;
    
    excludeBtn.textContent = 'Excluding...';
    excludeBtn.disabled = true;
    statusEl.textContent = 'Excluding placements...';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'performExclusion' }, (response) => {
          if (chrome.runtime.lastError || !response?.success) {
            statusEl.textContent = 'Exclusion failed';
            statusEl.classList.add('error');
            excludeBtn.textContent = 'Exclude All Junk';
            excludeBtn.disabled = false;
            return;
          }
          
          statusEl.textContent = `Excluded ${response.excludedCount} placements`;
          statusEl.classList.add('success');
          excludeBtn.textContent = 'Excluded ✓';
          
          showToast(`Success! Excluded ${response.excludedCount} junk placements.`);
        });
      }
    });
  });
  
  // Save report button
  saveBtn.addEventListener('click', () => {
    if (currentPlacements.length === 0) return;
    
    const csvContent = generateCSV(currentPlacements, currentTotalSpend);
    const filename = `pmax-sentry-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    
    showToast('Report saved to Downloads!');
  });
  
  function displayPlacements(placements) {
    placementList.innerHTML = '';
    
    if (placements.length === 0) {
      placementList.innerHTML = '<li class="no-results">No junk placements found. Great job!</li>';
      return;
    }
    
    placements.forEach((placement, index) => {
      const li = document.createElement('li');
      li.className = 'placement-item';
      li.style.animationDelay = `${index * 0.05}s`;
      li.innerHTML = `
        <span class="channel-name">${placement.channel}</span>
        <span class="spend">£${placement.spend.toFixed(2)}</span>
      `;
      placementList.appendChild(li);
    });
  }
  
  function updateWastedSpend(amount) {
    wasteDisplayEl.textContent = `£${amount.toFixed(2)}`;
  }
  
  function saveScanResults(placements, totalSpend) {
    chrome.storage.local.set({
      wastedSpend: totalSpend,
      lastPlacements: placements,
      lastScanTime: Date.now()
    });
    
    const scanDate = new Date();
    lastScanTimeEl.textContent = `Last scanned: ${scanDate.toLocaleString()}`;
  }
  
  function updateButtonStates() {
    const hasResults = currentPlacements.length > 0;
    excludeBtn.disabled = !hasResults;
    saveBtn.disabled = !hasResults;
  }
  
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 300);
    }, 3000);
  }
  
  function generateCSV(placements, totalSpend) {
    const headers = 'Channel,Spend (£)\n';
    const rows = placements.map(p => `${p.channel},${p.spend.toFixed(2)}`).join('\n');
    const total = `\nTOTAL,${totalSpend.toFixed(2)}`;
    return headers + rows + total;
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
});