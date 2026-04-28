#!/usr/bin/env node

// PMax Sentry - Build Script with Obfuscation
// Usage: node build.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JSOBFUSCATOR = require('javascript-obfuscator');

const SRC_DIR = __dirname;
const BUILD_DIR = path.join(__dirname, 'dist');
const OBFUSCATED_DIR = path.join(__dirname, 'obfuscated');

console.log('🔧 PMax Sentry Build Pipeline');
console.log('============================\n');

// Check dependencies
try {
  require.resolve('javascript-obfuscator');
} catch (e) {
  console.log('Installing javascript-obfuscator...');
  execSync('npm install javascript-obfuscator --save-dev', { cwd: SRC_DIR, stdio: 'inherit' });
}

// Create directories
[BUILD_DIR, OBFUSCATED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Files to obfuscate
const filesToObfuscate = [
  { src: 'content.js', dest: 'content.js' },
  { src: 'sidepanel.js', dest: 'sidepanel.js' },
  { src: 'background.js', dest: 'background.js' }
];

// Files to copy as-is
const filesToCopy = [
  'manifest.json',
  'sidepanel.html',
  'styles.css',
  'junk_channels.json'
];

// Copy directory helper
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Step 1: Copy source to build
console.log('Step 1: Copying source files...');
filesToCopy.forEach(file => {
  const srcPath = path.join(SRC_DIR, file);
  const destPath = path.join(BUILD_DIR, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${file}`);
  }
});

// Copy icons directory
if (fs.existsSync(path.join(SRC_DIR, 'icons'))) {
  copyDir(path.join(SRC_DIR, 'icons'), path.join(BUILD_DIR, 'icons'));
  console.log('  ✓ icons/');
}

// Step 2: Obfuscate JS files
console.log('\nStep 2: Obfuscating JavaScript...');

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.1,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  rotateStringArray: true,
  selfDefending: true,
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64', 'rc4'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  // Chrome extension specific - don't break these
  reservedNames: ['chrome', 'browser', 'window', 'document'],
  reservedStrings: ['chrome\\.', 'browser\\.', 'chrome\\.runtime', 'chrome\\.storage']
};

filesToObfuscate.forEach(({ src, dest }) => {
  const srcPath = path.join(SRC_DIR, src);
  const destPath = path.join(BUILD_DIR, dest);
  
  if (fs.existsSync(srcPath)) {
    const code = fs.readFileSync(srcPath, 'utf8');
    
    try {
      const obfuscated = JSOBFUSCATOR.obfuscate(code, obfuscationOptions);
      fs.writeFileSync(destPath, obfuscated.getObfuscatedCode());
      console.log(`  ✓ ${src} → ${dest} (obfuscated)`);
    } catch (error) {
      console.error(`  ✗ ${src} failed:`, error.message);
      // Fallback to copy
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ⚠ ${src} → ${dest} (copied without obfuscation)`);
    }
  }
});

// Step 3: Remove local junk_channels.json from build
console.log('\nStep 3: Securing data source...');
const junkPath = path.join(BUILD_DIR, 'junk_channels.json');
if (fs.existsSync(junkPath)) {
  fs.unlinkSync(junkPath);
  console.log('  ✓ Removed local junk_channels.json (data now API-only)');
}

// Step 4: Create README for testers
console.log('\nStep 4: Creating build documentation...');
const readmeContent = `# PMax Sentry - Alpha Build

## Installation
1. Unzip this package
2. Open Chrome → chrome://extensions/
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select this folder

## License Activation
On first run, you'll be prompted to enter a license key.
Contact support for an Alpha testing key.

## Features
- Dual-tier detection (Confirmed + Suspected waste)
- 2000+ channel database
- International coverage (EN/ES/PT/HI)
- O(1) performance with Set-based lookups

## Support
Email: automateworksdev@gmail.com

---
Build: ${new Date().toISOString()}
Version: 2.1.0-LICENSED
`;

fs.writeFileSync(path.join(BUILD_DIR, 'README.txt'), readmeContent);
console.log('  ✓ README.txt created');

// Step 5: Create distributable ZIP
console.log('\nStep 5: Creating distributable...');
const zipName = `pmax-sentry-v2.1-alpha-${Date.now()}.zip`;
const zipPath = path.join(__dirname, zipName);

try {
  execSync(`cd "${BUILD_DIR}" && zip -r "${zipPath}" .`, { stdio: 'ignore' });
  console.log(`  ✓ ${zipName} created`);
} catch (e) {
  console.log('  ⚠ ZIP creation failed (install zip command)');
}

// Summary
console.log('\n✅ Build Complete!');
console.log('===================');
console.log(`Output: ${BUILD_DIR}/`);
console.log(`Archive: ${zipName}`);
console.log('\nNext steps:');
console.log('1. Deploy Supabase Edge Function');
console.log('2. Run database migration');
console.log('3. Upload junk data to Supabase');
console.log('4. Distribute ZIP to testers');