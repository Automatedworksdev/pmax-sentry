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
      console.error('[PMax] Extension context invalid - cannot send message');
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
  
  // Safe tab message sender with timeout and error handling
  function sendTabMessage(tabId, message, callback) {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.error('[PMax] Extension context invalid');
      if (callback) callback(null);
      return;
    }
    
    var timeoutId = setTimeout(function() {
      console.warn('[PMax] Tab message timeout');
      if (callback) callback({ error: 'Message timeout' });
      callback = null; // Prevent double callback
    }, 5000); // 5 second timeout
    
    try {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          var errorMsg = chrome.runtime.lastError.message;
          // Only log real errors, not expected 'Receiving end does not exist' when tab closed/refreshed
          if (errorMsg && errorMsg.indexOf('Receiving end does not exist') === -1) {
            console.error('[PMax] Tab message error:', errorMsg);
          }
          if (callback) callback({ error: errorMsg });
          return;
        }
        if (callback) callback(response);
      });
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('[PMax] Send tab message failed:', e);
      if (callback) callback({ error: e.message });
    }
  }
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
      if (statusEl) statusEl.textContent = 'Checking data...';
      
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (!tabs[0] || !tabs[0].id) {
          scanBtn.disabled = false;
          if (statusEl) statusEl.textContent = 'Error: No active tab';
          return;
        }
        
        var tabId = tabs[0].id;
        
        // First check if content script has data
        sendTabMessage(tabId, { action: 'ping' }, function(pingResponse) {
          if (!pingResponse || pingResponse.error) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan Placements';
            if (statusEl) statusEl.textContent = 'Error: ' + (pingResponse ? pingResponse.error : 'No response');
            return;
          }
          
          console.log('[PMax] Ping response:', pingResponse);
          
          if (!pingResponse.dataLoaded || pingResponse.channelCount === 0) {
            if (statusEl) statusEl.textContent = 'Loading data...';
            
            sendTabMessage(tabId, { action: 'reloadData' }, function(reloadResponse) {
              if (!reloadResponse || reloadResponse.error || !reloadResponse.success) {
                scanBtn.disabled = false;
                scanBtn.textContent = 'Scan Placements';
                if (statusEl) statusEl.textContent = 'Data not loaded. Click Sync button.';
                return;
              }
              
              if (reloadResponse.dataLoaded && reloadResponse.channelCount > 0) {
                performScan();
              } else {
                scanBtn.disabled = false;
                scanBtn.textContent = 'Scan Placements';
                if (statusEl) statusEl.textContent = 'Data not loaded. Click Sync button.';
              }
            });
            return;
          }
          
          performScan();
        });
        
        function performScan() {
          if (statusEl) statusEl.textContent = 'Scanning...';
          
          sendTabMessage(tabId, { action: 'scanPlacements' }, function(response) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan Placements';
            
            if (!response || response.error) {
              if (statusEl) statusEl.textContent = 'Error: ' + (response ? response.error : 'No response');
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
        }
      });
    });
  }
  
  // Exclude - Enhanced with modal and copy functionality
  if (excludeBtn) {
    excludeBtn.addEventListener('click', function() {
      // Check if scan results exist
      var totalJunk = (scanResults.tier1 && scanResults.tier1.length || 0) + 
                      (scanResults.tier2 && scanResults.tier2.length || 0);
      
      if (totalJunk === 0) {
        // Show toast for empty state
        showToast('No junk placements found to exclude.');
        return;
      }
      
      // Collect all channel IDs from scan results
      var exclusionList = [];
      
      // Add tier 1 (confirmed) channels
      if (scanResults.tier1 && scanResults.tier1.length) {
        scanResults.tier1.forEach(function(placement) {
          if (placement.channel) {
            exclusionList.push(placement.channel);
          }
        });
      }
      
      // Add tier 2 (suspected) channels
      if (scanResults.tier2 && scanResults.tier2.length) {
        scanResults.tier2.forEach(function(placement) {
          if (placement.channel) {
            exclusionList.push(placement.channel);
          }
        });
      }
      
      // Show exclusion modal
      showExclusionModal(exclusionList);
    });
  }
  
  // Toast notification function
  function showToast(message) {
    // Remove existing toast
    var existingToast = document.getElementById('pmax-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    var toast = document.createElement('div');
    toast.id = 'pmax-toast';
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#374151;color:white;padding:12px 24px;border-radius:8px;font-size:13px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:toastSlideUp 0.3s ease;';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(function() {
      toast.style.animation = 'toastSlideDown 0.3s ease';
      setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
  }
  
  // Exclusion Modal function
  function showExclusionModal(channelList) {
    // Remove existing modal
    var existingModal = document.getElementById('pmax-exclusion-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.id = 'pmax-exclusion-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:modalFadeIn 0.2s ease;';
    
    // Create modal content
    var modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:12px;max-width:500px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:modalSlideUp 0.3s ease;';
    
    // Modal header
    var header = document.createElement('div');
    header.style.cssText = 'padding:20px 24px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;';
    header.innerHTML = '<h3 style="margin:0;font-size:16px;font-weight:600;color:#111827;">🚫 Exclusion List (' + channelList.length + ' channels)</h3>' +
                       '<button id="modal-close" style="background:none;border:none;cursor:pointer;font-size:20px;color:#6b7280;padding:4px;border-radius:4px;">&times;</button>';
    
    // Modal body
    var body = document.createElement('div');
    body.style.cssText = 'padding:20px 24px;flex:1;overflow:hidden;display:flex;flex-direction:column;';
    
    var textarea = document.createElement('textarea');
    textarea.id = 'exclusion-textarea';
    textarea.style.cssText = 'width:100%;flex:1;min-height:200px;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-family:monospace;font-size:12px;resize:none;white-space:pre;overflow:auto;';
    textarea.value = channelList.join('\n');
    
    var infoText = document.createElement('div');
    infoText.style.cssText = 'font-size:11px;color:#6b7280;margin-top:8px;';
    infoText.innerHTML = '<span style="color:#ef4444;">●</span> Confirmed: ' + (scanResults.tier1 && scanResults.tier1.length || 0) + ' | <span style="color:#f59e0b;">●</span> Suspected: ' + (scanResults.tier2 && scanResults.tier2.length || 0);
    
    body.appendChild(textarea);
    body.appendChild(infoText);
    
    // Modal footer
    var footer = document.createElement('div');
    footer.style.cssText = 'padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;gap:12px;justify-content:flex-end;';
    
    var copyBtn = document.createElement('button');
    copyBtn.id = 'copy-exclusion-btn';
    copyBtn.style.cssText = 'background:#1a73e8;color:white;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.2s;';
    copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>Copy to Clipboard';
    
    var closeBtn = document.createElement('button');
    closeBtn.id = 'close-modal-btn';
    closeBtn.style.cssText = 'background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;';
    closeBtn.textContent = 'Close';
    
    footer.appendChild(copyBtn);
    footer.appendChild(closeBtn);
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus textarea and select all
    textarea.focus();
    textarea.select();
    
    // Event listeners
    document.getElementById('modal-close').addEventListener('click', function() {
      overlay.remove();
    });
    
    document.getElementById('close-modal-btn').addEventListener('click', function() {
      overlay.remove();
    });
    
    copyBtn.addEventListener('click', function() {
      textarea.select();
      document.execCommand('copy');
      
      // Show copied feedback
      copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!';
      copyBtn.style.background = '#10b981';
      
      setTimeout(function() {
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path></svg>Copy to Clipboard';
        copyBtn.style.background = '#1a73e8';
      }, 2000);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
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
    if (tier1Spend) tier1Spend.textContent = '£' + Number((scanResults.totalSpend && scanResults.totalSpend.tier1) || 0).toFixed(2);
    if (tier2Spend) tier2Spend.textContent = '£' + Number((scanResults.totalSpend && scanResults.totalSpend.tier2) || 0).toFixed(2);
    
    if (tier1List) {
      tier1List.innerHTML = '';
      if (scanResults.tier1 && scanResults.tier1.length) {
        scanResults.tier1.forEach(function(p) {
          var li = document.createElement('li');
          var spendValue = Number(p.spend || 0).toFixed(2);
          li.innerHTML = '<span>' + p.channel + '</span><span>£' + spendValue + '</span>';
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
          var spendValue = Number(p.spend || 0).toFixed(2);
          li.innerHTML = '<span>' + p.channel + '</span><span>£' + spendValue + '</span>';
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
          var cat = _ref[0], spendData = _ref[1];
          var spendValue = typeof spendData === 'object' ? (spendData.spend || 0) : spendData;
          var div = document.createElement('div');
          div.className = 'category-row';
          div.innerHTML = '<span class="category-name">' + cat + '</span><span class="category-spend">£' + Number(spendValue).toFixed(2) + '</span>';
          categoryBreakdown.appendChild(div);
        });
      }
    }
    
    excludeBtn.disabled = false;  // Always enable - will show toast if no results
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
  
  // Debug: Ensure buttons are enabled
  console.log('[PMax] Initializing buttons...');
  console.log('[PMax] excludeBtn found:', !!excludeBtn, 'disabled:', excludeBtn ? excludeBtn.disabled : 'N/A');
  console.log('[PMax] saveBtn found:', !!saveBtn, 'disabled:', saveBtn ? saveBtn.disabled : 'N/A');
  
  // Force enable buttons
  if (excludeBtn) {
    excludeBtn.disabled = false;
    console.log('[PMax] Exclude All button enabled');
  }
  if (saveBtn) {
    saveBtn.disabled = false;
    console.log('[PMax] Save Report button enabled');
  }
});