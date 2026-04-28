#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'dist');

// Clean and recreate
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true });
}
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Files to copy
const files = ['manifest.json', 'sidepanel.html', 'styles.css', 'content.js', 'sidepanel.js'];
files.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join(BUILD_DIR, f));
    console.log('✓', f);
  }
});

// Copy icons
if (fs.existsSync('icons')) {
  fs.mkdirSync(path.join(BUILD_DIR, 'icons'));
  fs.readdirSync('icons').forEach(icon => {
    fs.copyFileSync(path.join('icons', icon), path.join(BUILD_DIR, 'icons', icon));
  });
  console.log('✓ icons/');
}

// Create background.js with embedded data
const bgContent = \`// PMax Sentry Background v2.1 - Embedded Data Edition
const EMBEDDED_DATA = {
  version: '2.0.0',
  totalChannels: 10,
  channels: [
    { name: 'Kids TV', type: 'Kids' },
    { name: 'Gaming Channel', type: 'Gaming' },
    { name: 'Music Videos', type: 'Music' },
    { name: 'ASMR Sounds', type: 'ASMR' },
    { name: 'News 24/7', type: 'News' },
    { name: 'Cartoon Network', type: 'Kids' },
    { name: 'Mobile Games', type: 'Gaming' },
    { name: 'Pop Music', type: 'Music' },
    { name: 'Sleep ASMR', type: 'ASMR' },
    { name: 'Breaking News', type: 'News' }
  ],
  suspectedKeywords: ['kids','gaming','music','asmr','news','cartoon','mobile','pop','sleep','breaking']
};

let licenseStatus = { valid: false, key: null };

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function validateLicense(key) {
  if (key && key.startsWith('PMX-') && key.length === 16) {
    await chrome.storage.local.set({ licenseKey: key, validated: true });
    licenseStatus = { valid: true, key: key };
    
    const channelSet = new Set();
    const typeMap = new Map();
    EMBEDDED_DATA.channels.forEach(c => {
      const n = c.name.toLowerCase().trim();
      channelSet.add(n);
      typeMap.set(n, c.type);
    });
    
    await chrome.storage.local.set({
      channelSet: Array.from(channelSet),
      channelTypeMap: Array.from(typeMap.entries()),
      suspectedKeywords: EMBEDDED_DATA.suspectedKeywords,
      totalChannels: EMBEDDED_DATA.totalChannels
    });
    
    return { valid: true, uses: 1, maxUses: 10 };
  }
  return { valid: false, error: 'Invalid format. Use PMX-XXXX-XXXX-XXXX' };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'validateLicense') {
    validateLicense(req.key).then(r => sendResponse(r));
    return true;
  }
  if (req.action === 'getLicenseStatus') {
    sendResponse(licenseStatus);
    return true;
  }
  if (req.action === 'checkChannel') {
    chrome.storage.local.get(['channelSet','channelTypeMap','suspectedKeywords','validated']).then(d => {
      if (!d.validated) { sendResponse({error:'License required'}); return; }
      const normalized = (req.channel||'').toLowerCase().trim();
      const channelSet = new Set(d.channelSet||[]);
      const typeMap = new Map(d.channelTypeMap||[]);
      if (channelSet.has(normalized)) {
        sendResponse({tier:'tier1',type:typeMap.get(normalized)});
        return;
      }
      for (const kw of (d.suspectedKeywords||[])) {
        if (normalized.includes(kw)) { sendResponse({tier:'tier2',type:'Suspected',keyword:kw}); return; }
      }
      sendResponse({tier:'none'});
    });
    return true;
  }
  if (req.action === 'getChannelStats') {
    chrome.storage.local.get(['totalChannels','validated']).then(d => {
      sendResponse({totalChannels:d.totalChannels||10,licensed:!!d.validated});
    });
    return true;
  }
});
\`;

fs.writeFileSync(path.join(BUILD_DIR, 'background.js'), bgContent);
console.log('✓ background.js (embedded data)');

// Create README
const readme = \`PMax Sentry v2.1 - Test Build
=============================

INSTALLATION:
1. Open Chrome → chrome://extensions/
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this folder

LICENSE KEYS (any format):
- PMX-TEST-TEST-TEST
- PMX-ABCD-EFGH-IJKL
- PMX-1111-2222-3333
- PMX-${Array(3).fill(0).map(()=>Math.random().toString(36).substring(2,6).toUpperCase()).join('-')}

Just needs to start with PMX- and be 16 chars total.

FEATURES:
- 10 test channels embedded
- No network required
- Works offline
\`;

fs.writeFileSync(path.join(BUILD_DIR, 'README.txt'), readme);
console.log('✓ README.txt');

// Create ZIP
const { execSync } = require('child_process');
const zipName = 'pmax-sentry-v2.1-test.zip';
process.chdir(BUILD_DIR);
execSync(\`zip -r "\${path.join('..', zipName)}" .\`);
console.log('\\n✅ Build complete:', zipName);
console.log('Size:', (fs.statSync(path.join('..', zipName)).size/1024).toFixed(2) + ' KB');