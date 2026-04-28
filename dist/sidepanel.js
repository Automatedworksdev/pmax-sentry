// Ultra-simple sidepanel

console.log('Sidepanel loading...');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  
  const licenseView = document.getElementById('license-view');
  const dashboardView = document.getElementById('dashboard-view');
  const licenseInput = document.getElementById('license-key');
  const validateBtn = document.getElementById('validate-license-btn');
  const licenseStatus = document.getElementById('license-status');
  
  // Show license view
  licenseView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  
  validateBtn.addEventListener('click', () => {
    const key = licenseInput.value.trim();
    console.log('Button clicked, key:', key);
    
    if (!key) {
      licenseStatus.innerHTML = '<span style="color:red">❌ Enter a key</span>';
      return;
    }
    
    validateBtn.disabled = true;
    validateBtn.textContent = 'Working...';
    licenseStatus.textContent = '';
    
    // Simple check - no network needed
    if (key.startsWith('PMX-')) {
      licenseStatus.innerHTML = '<span style="color:green">✓ Valid! Loading...</span>';
      
      // Save to storage
      chrome.storage.local.set({ licensed: true, licenseKey: key }, () => {
        setTimeout(() => {
          licenseView.classList.add('hidden');
          dashboardView.classList.remove('hidden');
          document.getElementById('status').textContent = 'Licensed: ' + key;
        }, 1000);
      });
    } else {
      licenseStatus.innerHTML = '<span style="color:red">❌ Key must start with PMX-</span>';
      validateBtn.disabled = false;
      validateBtn.textContent = 'Activate';
    }
  });
  
  // Check if already licensed
  chrome.storage.local.get(['licensed'], (data) => {
    if (data.licensed) {
      licenseView.classList.add('hidden');
      dashboardView.classList.remove('hidden');
      document.getElementById('status').textContent = 'Already licensed';
    }
  });
});

console.log('Sidepanel script loaded');