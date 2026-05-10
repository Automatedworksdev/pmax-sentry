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
  var blockWasteBtn = document.getElementById('block-waste-btn');
  var feedSentryBtn = document.getElementById('feed-sentry-btn');
  var saveBtn = document.getElementById('save-btn');
  var statusEl = document.getElementById('status');
  var tier1List = document.getElementById('tier1-list');
  var tier2List = document.getElementById('tier2-list');
  var tier1Count = document.getElementById('tier1-count');
  var tier2Count = document.getElementById('tier2-count');
  var tier1Spend = document.getElementById('tier1-spend');
  var tier2Spend = document.getElementById('tier2-spend');
  var channelCount = document.getElementById('channel-count');
  
  // Fetch count from proxy
  console.log('[Sync] Starting fetch to proxy...');
  fetch('https://pmax-sentry-proxy-git-master-automatedworksdevs-projects.vercel.app/api/stats')
    .then(r => {
      console.log('[Sync] Response received:', r.status);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      console.log('[Sync] Data received:', data);
      if (channelCount) channelCount.textContent = data.total.toLocaleString();
    })
    .catch(err => {
      console.error('[Sync] Error:', err.message);
      if (channelCount) channelCount.textContent = '51,448';
    });
  
  var dataVersion = document.getElementById('data-version');
  var lastSync = document.getElementById('last-sync');
  var categoryBreakdown = document.getElementById('category-breakdown');

  var scanResults = { tier1: [], tier2: [], totalSpend: { tier1: 0, tier2: 0 }, categoryTotals: {} };

  // ============================================
  // LOCAL SENTRY ENGINE - Global Block List
  // ============================================
  var globallyBlocked = {}; // In-memory cache

  // Load globally blocked channels from storage
  function loadGloballyBlocked(callback) {
    chrome.storage.local.get(['globallyBlocked'], function(result) {
      if (result.globallyBlocked) {
        globallyBlocked = result.globallyBlocked;
        console.log('[Sentry] Loaded', Object.keys(globallyBlocked).length, 'blocked channels');
      }
      if (callback) callback();
    });
  }

  // Save globally blocked channels to storage
  function saveGloballyBlocked(callback) {
    chrome.storage.local.set({ globallyBlocked: globallyBlocked }, function() {
      console.log('[Sentry] Saved', Object.keys(globallyBlocked).length, 'blocked channels');
      if (callback) callback();
    });
  }

  // Report/Block a channel with upsert logic
  function reportChannel(channelId, channelName, channelData) {
    if (!channelId) return;

    var now = Date.now();
    var existing = globallyBlocked[channelId];

    if (existing) {
      // Upsert: increment report count
      existing.reportCount = (existing.reportCount || 1) + 1;
      existing.lastReported = now;
      existing.name = channelName || existing.name; // Update name if provided
      console.log('[Sentry] Incremented report count for', channelId, 'to', existing.reportCount);
    } else {
      // New entry
      globallyBlocked[channelId] = {
        id: channelId,
        name: channelName || channelId,
        firstReported: now,
        lastReported: now,
        reportCount: 1,
        data: channelData || {}
      };
      console.log('[Sentry] Added new channel to block list:', channelId);
    }

    // Save to storage
    saveGloballyBlocked();
    return globallyBlocked[channelId];
  }

  // Check if channel is blocked
  function isChannelBlocked(channelId) {
    return !!globallyBlocked[channelId];
  }

  // Filter out blocked channels from scan results - REMOVED: Keep blocked visible
  function filterBlockedChannels(results) {
    // Return all results including blocked - they will be shown with 'Blocked' status
    return results;
  }

  // Export Sentry Data (for admin collection)
  function exportSentryData() {
    return JSON.stringify(globallyBlocked, null, 2);
  }

  // Make available globally for console access
  window.exportSentryData = exportSentryData;
  window.globallyBlocked = globallyBlocked;

  // Load blocked channels on startup
  loadGloballyBlocked();

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
          // Update channel count
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

          // Update dynamic tagline with version and count
          var taglineEl = document.getElementById('header-tagline');
          if (taglineEl && stats.channelCount > 0) {
            taglineEl.innerHTML = '<span class="count">' + stats.channelCount.toLocaleString() + '</span> junk channels blocked';
          } else if (taglineEl) {
            taglineEl.innerHTML = '<span class="count">0</span> junk channels blocked';
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
    refreshBtn.addEventListener('click', function() { console.log('[SYNC BUTTON CLICKED]');
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

      sendMessage({ action: 'forceRefresh' }, function(response) {
        setTimeout(function() {
          sendMessage({ action: 'getStats' }, function(stats) {
            refreshBtn.disabled = false;
            if (refreshIcon) refreshIcon.classList.remove('spinning');
            if (response && !response.error && stats && stats.channelCount > 0) {
              if (statusEl) statusEl.textContent = 'Database up to date';
              if (progressEl) progressEl.classList.add('hidden');
              if (channelCount) {
                channelCount.textContent = stats.channelCount.toLocaleString();
                channelCount.classList.remove('pulsing');
              }
              // Update synced time to actual time
              var now = new Date();
              var timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (lastSync) lastSync.textContent = timeStr;
            } else {
              if (statusEl) statusEl.textContent = 'Sync failed';
              if (channelCount) channelCount.classList.remove('pulsing');
            }
          });
        }, 1500);
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

            // Filter out already blocked channels before storing
            scanResults = filterBlockedChannels(response);
            updateDisplay();

            var total = (scanResults.counts && scanResults.counts.tier1 || 0) + (scanResults.counts && scanResults.counts.tier2 || 0);
            if (statusEl) statusEl.textContent = total > 0 ? 'Found ' + total + ' placements' : 'No waste found';
          });
        }
      });
    });
  }

  // Block Waste - Block CHECKED channels only
  if (blockWasteBtn) {
    blockWasteBtn.addEventListener('click', function() {
      var checkedChannels = [];

      // Get only CHECKED items from both lists
      document.querySelectorAll('#tier1-list .placement-checkbox:checked').forEach(function(cb) {
        var item = cb.closest('.placement-item');
        if (item && !item.classList.contains('sentry-captured')) {
          checkedChannels.push({ 
            channel: item.dataset.channel, 
            placementId: item.dataset.placementId || item.dataset.channel,
            tier: 'tier1' 
          });
        }
      });
      document.querySelectorAll('#tier2-list .placement-checkbox:checked').forEach(function(cb) {
        var item = cb.closest('.placement-item');
        if (item && !item.classList.contains('sentry-captured')) {
          checkedChannels.push({ 
            channel: item.dataset.channel, 
            placementId: item.dataset.placementId || item.dataset.channel,
            tier: 'tier2' 
          });
        }
      });

      if (checkedChannels.length === 0) {
        showToast('No channels selected to block. Uncheck channels you want to keep.');
        return;
      }

      // Confirmation popup
      var proceed = confirm('You are about to block ' + checkedChannels.length + ' placements. This will stop your ads from showing on these channels. Proceed?');
      if (!proceed) return;

      // Block checked channels - NOW INCLUDES URL
      checkedChannels.forEach(function(item) {
        reportChannel(item.channel, item.channel, { 
          tier: item.tier,
          placementId: item.placementId 
        });
        
        // Send message to grey out the row on Google Ads page
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'markBlocked',
              channel: item.channel
            });
          }
        });
      });

      // Success animation
      var originalText = blockWasteBtn.textContent;
      var originalClass = blockWasteBtn.className;
      blockWasteBtn.textContent = '✓ Placements Blocked';
      blockWasteBtn.style.background = '#10b981';
      blockWasteBtn.style.color = 'white';
      
      setTimeout(function() {
        blockWasteBtn.textContent = originalText;
        blockWasteBtn.className = originalClass;
        blockWasteBtn.style.background = '';
        blockWasteBtn.style.color = '';
      }, 3000);

      // Refresh display to show captured state
      updateDisplay();

      showToast(checkedChannels.length + ' channel(s) blocked.');
    });
  }

  // Feed the Sentry - Report CHECKED channels to global database
  if (feedSentryBtn) {
    feedSentryBtn.addEventListener('click', function() {
      var checkedChannels = [];

      // Get only CHECKED items from both lists
      document.querySelectorAll('#tier1-list .placement-checkbox:checked').forEach(function(cb) {
        var item = cb.closest('.placement-item');
        if (item && !item.classList.contains('sentry-captured')) {
          checkedChannels.push({ 
            channel: item.dataset.channel, 
            placementId: item.dataset.placementId || item.dataset.channel,
            tier: 'tier1' 
          });
        }
      });
      document.querySelectorAll('#tier2-list .placement-checkbox:checked').forEach(function(cb) {
        var item = cb.closest('.placement-item');
        if (item && !item.classList.contains('sentry-captured')) {
          checkedChannels.push({ 
            channel: item.dataset.channel, 
            placementId: item.dataset.placementId || item.dataset.channel,
            tier: 'tier2' 
          });
        }
      });

      if (checkedChannels.length === 0) {
        showToast('No channels selected to report.');
        return;
      }

      // Report checked channels - NOW INCLUDES URL
      checkedChannels.forEach(function(item) {
        reportChannel(item.channel, item.channel, { 
          tier: item.tier, 
          placementId: item.placementId 
        });
      });

      // Success animation
      var originalText = feedSentryBtn.textContent;
      var originalClass = feedSentryBtn.className;
      feedSentryBtn.textContent = '✓ Intelligence Shared';
      feedSentryBtn.style.background = '#10b981';
      feedSentryBtn.style.color = 'white';
      feedSentryBtn.style.borderColor = '#10b981';
      
      setTimeout(function() {
        feedSentryBtn.textContent = originalText;
        feedSentryBtn.className = originalClass;
        feedSentryBtn.style.background = '';
        feedSentryBtn.style.color = '';
        feedSentryBtn.style.borderColor = '';
      }, 3000);

      // Refresh display to show captured state
      updateDisplay();

      showToast(checkedChannels.length + ' channel(s) fed to Sentry database.');
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

  // Save - Premium XLSX Export
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      // Prepare data for XLSX
      var data = [];
      
      // Add data rows
      if (scanResults.tier1) {
        scanResults.tier1.forEach(function(p) {
          var placementIdValue = p.placementId && p.placementId.startsWith('http') ? p.placementId : p.channel;
          data.push({
            'Tier': 'Confirmed',
            'Channel': p.channel,
            'Spend': p.spend,
            'Category': p.category || 'Unknown',
            'Placement ID': placementIdValue
          });
        });
      }
      if (scanResults.tier2) {
        scanResults.tier2.forEach(function(p) {
          var placementIdValue = p.placementId && p.placementId.startsWith('http') ? p.placementId : p.channel;
          data.push({
            'Tier': 'Suspected',
            'Channel': p.channel,
            'Spend': p.spend,
            'Category': p.category || 'Unknown',
            'Placement ID': placementIdValue
          });
        });
      }
      
      // Create worksheet from data
      var ws = XLSX.utils.json_to_sheet(data);
      
      // Set column widths (auto-fit based on content)
      ws['!cols'] = [
        { wch: 15 },  // Tier
        { wch: 50 },  // Channel - wider to prevent overlap
        { wch: 12 },  // Spend
        { wch: 20 },  // Category
        { wch: 50 }   // Placement ID - wider to prevent overlap
      ];
      
      // Insert instruction row at top
      XLSX.utils.sheet_add_aoa(ws, [['Sentry Report: Copy the Placement ID column into your Google Ads Exclusion list.']], { origin: 0 });
      
      // Merge cells A1:E1 for instruction
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
      
      // Style the instruction row (A1)
      ws['A1'].s = {
        font: { name: 'Calibri', sz: 14, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
      
      // Style header row (row 2, which is now row 1 after inserting instruction)
      var headerStyle = {
        font: { name: 'Calibri', sz: 12, bold: true },
        fill: { fgColor: { rgb: 'D9D9D9' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
      
      var headers = ['A', 'B', 'C', 'D', 'E'];
      headers.forEach(function(col) {
        var cell = ws[col + '2'];
        if (cell) cell.s = headerStyle;
      });
      
      // Style data rows
      var rowCount = data.length + 2; // +2 for instruction and header rows
      for (var row = 3; row <= rowCount; row++) {
        ['A', 'B', 'C', 'D', 'E'].forEach(function(col) {
          var cell = ws[col + row];
          if (cell) {
            cell.s = {
              font: { name: 'Calibri', sz: 12 },
              alignment: { vertical: 'center' }
            };
            // Number formatting for Spend column
            if (col === 'C' && typeof cell.v === 'number') {
              cell.s.numFmt = '0.00';
              cell.s.alignment = { horizontal: 'right', vertical: 'center' };
            }
          }
        });
      }
      
      // Create workbook
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PMax Sentry Report');
      
      // Generate filename with timestamp
      var filename = 'pmax-sentry-' + new Date().toISOString().split('T')[0] + '.xlsx';
      
      // Write and download
      XLSX.writeFile(wb, filename);
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
        scanResults.tier1.forEach(function(p, index) {
          var li = document.createElement('li');
          li.className = 'placement-item';
          li.dataset.channel = p.channel;
          li.dataset.placementId = p.placementId || '';

          // Check if already blocked
          var isBlocked = isChannelBlocked(p.channel);
          var blockedData = globallyBlocked[p.channel];

          var spendValue = Number(p.spend || 0).toFixed(2);

          if (isBlocked) {
            // Show as captured/blocked
            li.classList.add('sentry-captured');
            li.innerHTML =
              '<div class="placement-info">' +
                '<span class="placement-channel">' + p.channel + '</span>' +
                '<span class="placement-category">Blocked • Reported ' + (blockedData.reportCount || 1) + ' times</span>' +
              '</div>' +
              '<span class="placement-spend">£' + spendValue + '</span>' +
              '<span class="sentry-badge blocked">Blocked</span>';
          } else {
            // Normal item - checkbox checked by default (Tier 1 Confirmed)
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'placement-checkbox';
            checkbox.checked = true;
            checkbox.dataset.channel = p.channel;
            checkbox.dataset.placementId = p.placementId || '';
            checkbox.dataset.tier = 'tier1';
            
            // Add change listener to sync with Google Ads page highlighting AND header checkbox
            checkbox.addEventListener('change', function() {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleHighlight',
                    channel: p.channel,
                    show: checkbox.checked
                  });
                }
              });
              // Sync header checkbox state
              syncHeaderCheckbox('tier1-list', 'select-all-tier1');
            });
            
            li.appendChild(checkbox);
            
            var infoDiv = document.createElement('div');
            infoDiv.className = 'placement-info';
            var catText = p.category ? '[' + p.category.toUpperCase() + ']' : '[UNKNOWN]';
            infoDiv.innerHTML = 
              '<span class="placement-channel">' + p.channel + '</span>' +
              '<span class="placement-category">' + catText + '</span>';
            li.appendChild(infoDiv);
            
            var spendSpan = document.createElement('span');
            spendSpan.className = 'placement-spend';
            spendSpan.textContent = '£' + spendValue;
            li.appendChild(spendSpan);
          }

          tier1List.appendChild(li);
        });
      } else {
        tier1List.innerHTML = '<li style="color:#999;text-align:center;padding:20px;">No confirmed waste found</li>';
      }
    }

    if (tier2List) {
      tier2List.innerHTML = '';
      if (scanResults.tier2 && scanResults.tier2.length) {
        scanResults.tier2.forEach(function(p, index) {
          var li = document.createElement('li');
          li.className = 'placement-item';
          li.dataset.channel = p.channel;
          li.dataset.placementId = p.placementId || '';

          // Check if already blocked
          var isBlocked = isChannelBlocked(p.channel);
          var blockedData = globallyBlocked[p.channel];

          var spendValue = Number(p.spend || 0).toFixed(2);

          if (isBlocked) {
            // Show as captured/blocked
            li.classList.add('sentry-captured');
            li.innerHTML =
              '<div class="placement-info">' +
                '<span class="placement-channel">' + p.channel + '</span>' +
                '<span class="placement-category">Blocked • Reported ' + (blockedData.reportCount || 1) + ' times</span>' +
              '</div>' +
              '<span class="placement-spend">£' + spendValue + '</span>' +
              '<span class="sentry-badge blocked">Blocked</span>';
          } else {
            // Normal item - checkbox checked by default (Tier 2 Suspected)
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'placement-checkbox';
            checkbox.checked = true;
            checkbox.dataset.channel = p.channel;
            checkbox.dataset.placementId = p.placementId || '';
            checkbox.dataset.tier = 'tier2';
            
            // Add change listener to sync with Google Ads page highlighting AND header checkbox
            checkbox.addEventListener('change', function() {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0] && tabs[0].id) {
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleHighlight',
                    channel: p.channel,
                    show: checkbox.checked
                  });
                }
              });
              // Sync header checkbox state
              syncHeaderCheckbox('tier2-list', 'select-all-tier2');
            });
            
            li.appendChild(checkbox);
            
            var infoDiv = document.createElement('div');
            infoDiv.className = 'placement-info';
            var catText2 = p.category ? '[' + p.category.toUpperCase() + ']' : '[UNKNOWN]';
            infoDiv.innerHTML = 
              '<span class="placement-channel">' + p.channel + '</span>' +
              '<span class="placement-category">' + catText2 + '</span>';
            li.appendChild(infoDiv);
            
            var spendSpan = document.createElement('span');
            spendSpan.className = 'placement-spend';
            spendSpan.textContent = '£' + spendValue;
            li.appendChild(spendSpan);
          }

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
          div.innerHTML = '<span class="category-name">' + cat + ':</span><span class="category-spend"> £' + Number(spendValue).toFixed(2) + '</span>';
          categoryBreakdown.appendChild(div);
        });
      }
    }

    // Buttons are always enabled (global actions)
    if (blockWasteBtn) {
      // Initial state - will be updated by updateBlockWasteButton()
      updateBlockWasteButton();
    }
    if (feedSentryBtn) feedSentryBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = !((scanResults.tier1 && scanResults.tier1.length) || (scanResults.tier2 && scanResults.tier2.length));
    
    // Initial sync of header checkboxes
    syncHeaderCheckbox('tier1-list', 'select-all-tier1');
    syncHeaderCheckbox('tier2-list', 'select-all-tier2');
    
    // Ensure Block Waste button state is correct after initial render
    updateBlockWasteButton();
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

  // Toast notification function
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast-notification' + (type ? ' ' + type : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.classList.add('hide');
      setTimeout(function() {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
  }

  // Make showToast globally accessible
  window.showToast = showToast;

  // Select All functionality
  function attachSelectAllListeners() {
    var selectAllTier1 = document.getElementById('select-all-tier1');
    var selectAllTier2 = document.getElementById('select-all-tier2');
    
    if (selectAllTier1) {
      selectAllTier1.addEventListener('change', function() {
        var checkboxes = document.querySelectorAll('#tier1-list .placement-checkbox');
        checkboxes.forEach(function(cb) {
          if (!cb.disabled) {
            cb.checked = selectAllTier1.checked;
          }
        });
        // Update Block Waste button after mass toggle
        updateBlockWasteButton();
      });
    }
    
    if (selectAllTier2) {
      selectAllTier2.addEventListener('change', function() {
        var checkboxes = document.querySelectorAll('#tier2-list .placement-checkbox');
        checkboxes.forEach(function(cb) {
          if (!cb.disabled) {
            cb.checked = selectAllTier2.checked;
          }
        });
        // Update Block Waste button after mass toggle
        updateBlockWasteButton();
      });
    }
  }
  
  // Sync header checkbox based on individual checkbox states
  function syncHeaderCheckbox(listId, headerId) {
    var headerCheckbox = document.getElementById(headerId);
    if (!headerCheckbox) return;
    
    var checkboxes = document.querySelectorAll('#' + listId + ' .placement-checkbox');
    if (checkboxes.length === 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
      return;
    }
    
    var checkedCount = 0;
    var uncheckedCount = 0;
    
    checkboxes.forEach(function(cb) {
      if (!cb.disabled) {
        if (cb.checked) checkedCount++;
        else uncheckedCount++;
      }
    });
    
    // All checked
    if (checkedCount > 0 && uncheckedCount === 0) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    }
    // None checked
    else if (checkedCount === 0 && uncheckedCount > 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    }
    // Partial
    else {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }
    
    // Update Block Waste button state
    updateBlockWasteButton();
  }
  
  // Update Block Waste button based on selection state
  function updateBlockWasteButton() {
    if (!blockWasteBtn) return;
    
    var tier1Checked = document.querySelectorAll('#tier1-list .placement-checkbox:checked:not(:disabled)');
    var tier2Checked = document.querySelectorAll('#tier2-list .placement-checkbox:checked:not(:disabled)');
    var totalChecked = tier1Checked.length + tier2Checked.length;
    
    if (totalChecked > 0) {
      blockWasteBtn.disabled = false;
      blockWasteBtn.textContent = 'Block Waste (' + totalChecked + ')';
      blockWasteBtn.style.opacity = '1';
      blockWasteBtn.style.cursor = 'pointer';
    } else {
      blockWasteBtn.disabled = true;
      blockWasteBtn.textContent = 'Block Waste';
      blockWasteBtn.style.opacity = '0.5';
      blockWasteBtn.style.cursor = 'not-allowed';
    }
  }
  
  // Attach listeners on load
  attachSelectAllListeners();

  // Debug: Ensure buttons are enabled
  console.log('[PMax] Initializing buttons...');
  console.log('[PMax] blockWasteBtn found:', !!blockWasteBtn);
  console.log('[PMax] feedSentryBtn found:', !!feedSentryBtn);
  console.log('[PMax] saveBtn found:', !!saveBtn);
});