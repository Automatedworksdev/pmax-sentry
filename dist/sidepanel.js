document.addEventListener('DOMContentLoaded', function() {
  console.log('[PMax Sentry] Sidepanel loaded');
  
  // Check if extension context is valid
  if (!chrome.runtime || !chrome.runtime.id) {
    console.error('[PMax] Extension context invalid');
    return;
  }
  
  // Get elements
  var licenseView = document.getElementById('license-view');
  var dashboardView = document.getElementById('dashboard-view');
  var licenseInput = document.getElementById('license-key');
  var validateBtn = document.getElementById('validate-license-btn');
  var licenseStatus = document.getElementById('license-status');
  var scanBtn = document.getElementById('scan-btn');
  var excludeBtn = document.getElementById('exclude-btn');
  var saveBtn = document.getElementById('save-btn');
  var statusEl = document.getElementById('status');
  var tier1List = document.getElementById('tier1-list');
  var tier2List = document.getElementById('tier2-list');
  var tier1Count = document.getElementById('tier1-count');
  var tier2Count = document.getElementById('tier2-count');
  var tier1Spend = document.getElementById('tier1-spend');
  var tier2Spend = document.getElementById('tier2-spend');
  var channelCount = document.getElementById('channel-count');
  var dataVersion = document.getElementById('data-version');
  var lastSync = document.getElementById('last-sync');
  var categoryBreakdown = document.getElementById('category-breakdown');
  
  var scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 }, categoryTotals: {} };
  
  // Safe message sender
  function sendMessage(message, callback) {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.error('[PMax] Extension context invalid');
      return;
    }
    try {
      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) {
          console.error('[PMax] Message error:', chrome.runtime.lastError.message);
          return;
        }
        if (callback) callback(response);
      });
    } catch (e) {
      console.error('[PMax] Send message failed:', e);
    }
  }
  
  // Check license status
  checkLicenseStatus();
  
  function checkLicenseStatus() {
    sendMessage({ action: 'getLicenseStatus' }, function(response) {
      if (response && response.valid) {
        showDashboard();
        loadStats();
        sendMessage({ action: 'getSyncStatus' }, function(syncStatus) {
          if (syncStatus && syncStatus.syncStatus !== 'completed') {
            startSyncPolling();
          }
        });
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
    sendMessage({ action: 'getStats' }, function(stats) {
      sendMessage({ action: 'getSyncStatus' }, function(syncStatus) {
        if (stats) {
          if (channelCount) {
            if (syncStatus && syncStatus.syncStatus === 'in_progress') {
              channelCount.textContent = '...';
              channelCount.classList.add('pulsing');
              var progressEl = document.getElementById('sync-progress');
              if (progressEl) progressEl.classList.remove('hidden');
            } else if (stats.channelCount > 0) {
              channelCount.textContent = stats.channelCount.toLocaleString();
              channelCount.classList.remove('pulsing');
              var progressEl = document.getElementById('sync-progress');
              if (progressEl) progressEl.classList.add('hidden');
            } else {
              channelCount.textContent = '0';
              channelCount.classList.remove('pulsing');
            }
          }
          if (dataVersion) dataVersion.textContent = stats.version || '2.2';
          if (lastSync) {
            if (syncStatus && syncStatus.syncStatus === 'completed' && stats.syncedAt) {
              var date = new Date(stats.syncedAt);
              lastSync.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              lastSync.classList.remove('sync-pending', 'sync-error');
            } else if (syncStatus && syncStatus.syncStatus === 'failed') {
              lastSync.textContent = 'Failed';
              lastSync.classList.add('sync-error');
              lastSync.classList.remove('sync-pending');
            } else if (syncStatus && syncStatus.syncStatus === 'in_progress') {
              lastSync.textContent = 'Syncing...';
              lastSync.classList.add('sync-pending');
              lastSync.classList.remove('sync-error');
            } else {
              lastSync.textContent = '--';
              lastSync.classList.remove('sync-pending', 'sync-error');
            }
          }
        }
      });
    });
  }
  
  function updateProgress(percent) {
    var progressFill = document.getElementById('progress-fill');
    var progressText = document.getElementById('progress-text');
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = 'Downloading Database... ' + percent + '%';
  }
  
  // Sync button
  var refreshBtn = document.getElementById('sync-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      var refreshIcon = refreshBtn.querySelector('.refresh-icon');
      refreshBtn.disabled = true;
      if (refreshIcon) refreshIcon.classList.add('spinning');
      if (statusEl) statusEl.textContent = 'Syncing...';
      
      var progressEl = document.getElementById('sync-progress');
      if (channelCount) {
        channelCount.textContent = '...';
        channelCount.classList.add('pulsing');
      }
      if (progressEl) progressEl.classList.remove('hidden');
      
      sendMessage({ action: 'forceRefresh' }, function() {
        setTimeout(function() {
          sendMessage({ action: 'getSyncStatus' }, function(result) {
            sendMessage({ action: 'getStats' }, function(stats) {
              refreshBtn.disabled = false;
              if (refreshIcon) refreshIcon.classList.remove('spinning');
              if (result && result.syncStatus === 'completed' && stats && stats.channelCount > 0) {
                if (statusEl) statusEl.textContent = 'Ready to scan';
                if (progressEl) progressEl.classList.add('hidden');
                if (channelCount) channelCount.classList.remove('pulsing');
              } else {
                if (statusEl) statusEl.textContent = 'Sync failed';
              }
              loadStats();
            });
          });
        }, 2000);
      });
    });
  }
  
  // Poll sync status
  var syncPollInterval = null;
  function startSyncPolling() {
    if (syncPollInterval) clearInterval(syncPollInterval);
    syncPollInterval = setInterval(function() {
      sendMessage({ action: 'getSyncStatus' }, function(result) {
        if (result && result.syncStatus === 'in_progress') {
          updateProgress(result.syncProgress || 0);
        } else if (result && result.syncStatus === 'completed') {
          clearInterval(syncPollInterval);
          syncPollInterval = null;
          loadStats();
        } else if (result && result.syncStatus === 'failed') {
          clearInterval(syncPollInterval);
          syncPollInterval = null;
          var progressText = document.getElementById('progress-text');
          if (progressText) {
            progressText.textContent = 'Sync failed - Click retry';
            progressText.style.color = '#ef4444';
          }
        }
      });
    }, 1500);
  }
  
  // License validation
  if (validateBtn) {
    validateBtn.addEventListener('click', function() {
      var key = licenseInput.value.trim();
      if (!key) {
        if (licenseStatus) licenseStatus.textContent = 'Enter a license key';
        return;
      }
      
      validateBtn.disabled = true;
      validateBtn.innerHTML = '<span class="spinner"></span> Verifying...';
      if (licenseStatus) licenseStatus.textContent = '';
      
      var startTime = Date.now();
      
      sendMessage({ action: 'validateLicense', key: key }, function(response) {
        var elapsed = Date.now() - startTime;
        console.log('[PMax] License validation took ' + elapsed + 'ms');
        
        if (response && response.valid) {
          validateBtn.innerHTML = '✓ Activated!';
          if (licenseStatus) {
            licenseStatus.innerHTML = '<div style="color: #10b981; font-weight: 500;">✓ License Active<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Initial sync in progress...</div></div>';
          }
          setTimeout(function() {
            showDashboard();
            loadStats();
            startSyncPolling();
          }, 300);
        } else {
          validateBtn.disabled = false;
          validateBtn.textContent = 'Activate License';
          if (licenseStatus) {
            licenseStatus.innerHTML = '<span style="color: #ef4444;">' + (response ? response.error : 'Invalid key') + '</span>';
          }
        }
      });
    });
  }
  
  // Scan
  if (scanBtn) {
    scanBtn.addEventListener('click', function() {
      scanBtn.disabled = true;
      
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0] || !tabs[0].id) {
          scanBtn.disabled = false;
          if (statusEl) statusEl.textContent = 'Error: No active tab';
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPlacements' }, function(response) {
          scanBtn.disabled = false;
          scanBtn.textContent = 'Scan Placements';
          
          if (chrome.runtime.lastError) {
            if (statusEl) statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
          }
          
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
          
          var total = (response.counts && response.counts.tier1 || 0) + (response.counts && response.counts.tier2 || 0);
          if (statusEl) statusEl.textContent = total > 0 ? 'Found ' + total + ' placements' : 'No waste found';
        });
      });
    });
  }
  
  // Exclude
  if (excludeBtn) {
    excludeBtn.addEventListener('click', function() {
      excludeBtn.disabled = true;
      
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'performExclusion' }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('[PMax] Exclude error:', chrome.runtime.lastError.message);
              excludeBtn.disabled = false;
              return;
            }
            excludeBtn.disabled = false;
            if (response && response.success) {
              if (statusEl) statusEl.textContent = 'Excluded ' + response.excludedCount;
            }
          });
        }
      });
    });
  }
  
  // Save
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      var csv = 'Tier,Channel,Spend,Category\n';
      if (scanResults.tier1) {
        scanResults.tier1.forEach(function(p) {
          csv += 'Confirmed,' + p.channel + ',' + p.spend.toFixed(2) + ',' + p.category + '\n';
        });
      }
      if (scanResults.tier2) {
        scanResults.tier2.forEach(function(p) {
          csv += 'Suspected,' + p.channel + ',' + p.spend.toFixed(2) + ',' + p.category + '\n';
        });
      }
      
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'pmax-sentry-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    });
  }
  
  function updateDisplay() {
    if (tier1Count) tier1Count.textContent = (scanResults.counts && scanResults.counts.tier1) || 0;
    if (tier2Count) tier2Count.textContent = (scanResults.counts && scanResults.counts.tier2) || 0;
    if (tier1Spend) tier1Spend.textContent = '£' + ((scanResults.totalSpend && scanResults.totalSpend.tier1) || 0).toFixed(2);
    if (tier2Spend) tier2Spend.textContent = '£' + ((scanResults.totalSpend && scanResults.totalSpend.tier2) || 0).toFixed(2);
    
    if (tier1List) {
      tier1List.innerHTML = '';
      if (scanResults.tier1 && scanResults.tier1.length) {
        scanResults.tier1.forEach(function(p) {
          var li = document.createElement('li');
          li.innerHTML = '<span>' + p.channel + '</span><span>£' + p.spend.toFixed(2) + '</span>';
          tier1List.appendChild(li);
        });
      } else {
        tier1List.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">No confirmed waste found</li>';
      }
    }
    
    if (tier2List) {
      tier2List.innerHTML = '';
      if (scanResults.tier2 && scanResults.tier2.length) {
        scanResults.tier2.forEach(function(p) {
          var li = document.createElement('li');
          li.innerHTML = '<span>' + p.channel + '</span><span>£' + p.spend.toFixed(2) + '</span>';
          tier2List.appendChild(li);
        });
      } else {
        tier2List.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">No suspected waste found</li>';
      }
    }
    
    if (categoryBreakdown && scanResults.categoryTotals) {
      categoryBreakdown.innerHTML = '';
      var categories = Object.entries(scanResults.categoryTotals).sort(function(a, b) { return b[1] - a[1]; });
      if (categories.length === 0) {
        categoryBreakdown.innerHTML = '<div style="color:#999;text-align:center;padding:10px;">No data yet</div>';
      } else {
        categories.forEach(function(_ref) {
          var cat = _ref[0], spend = _ref[1];
          var div = document.createElement('div');
          div.className = 'category-row';
          div.innerHTML = '<span class="category-name">' + cat + '</span><span class="category-spend">£' + spend.toFixed(2) + '</span>';
          categoryBreakdown.appendChild(div);
        });
      }
    }
    
    excludeBtn.disabled = !((scanResults.tier1 && scanResults.tier1.length) || (scanResults.tier2 && scanResults.tier2.length));
    saveBtn.disabled = !((scanResults.tier1 && scanResults.tier1.length) || (scanResults.tier2 && scanResults.tier2.length));
  }
  
  // Listen for sync completion messages from background
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'syncComplete') {
      console.log('[PMax] Sync complete message received:', request.channels);
      // Clear polling interval if still running
      if (syncPollInterval) {
        clearInterval(syncPollInterval);
        syncPollInterval = null;
      }
      // Update UI
      loadStats();
      var progressEl = document.getElementById('sync-progress');
      if (progressEl) progressEl.classList.add('hidden');
      if (channelCount) channelCount.classList.remove('pulsing');
    }
    return true;
  });
});