#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = path.join(__dirname, 'dist');
const OBFUSCATED_DIR = path.join(__dirname, 'obfuscated');

console.log('🔧 PMax Sentry Build Pipeline');
console.log('============================\n');

// Create directories
[BUILD_DIR, OBFUSCATED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Files to copy
const filesToCopy = [
  'manifest.json',
  'sidepanel.html',
  'styles.css'
];

// Copy files
console.log('Step 1: Copying files...');
filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(BUILD_DIR, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${file}`);
  }
});

// Copy icons
if (fs.existsSync(path.join(__dirname, 'icons'))) {
  const iconFiles = fs.readdirSync(path.join(__dirname, 'icons'));
  if (!fs.existsSync(path.join(BUILD_DIR, 'icons'))) {
    fs.mkdirSync(path.join(BUILD_DIR, 'icons'));
  }
  iconFiles.forEach(icon => {
    fs.copyFileSync(
      path.join(__dirname, 'icons', icon),
      path.join(BUILD_DIR, 'icons', icon)
    );
  });
  console.log('  ✓ icons/');
}

// Copy JS files (no obfuscation for now to keep it simple)
const jsFiles = ['content.js', 'sidepanel.js', 'background.js'];
console.log('\nStep 2: Copying JavaScript...');
jsFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(BUILD_DIR, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${file}`);
  }
});

// Remove junk_channels.json (API only now)
console.log('\nStep 3: Securing data source...');
const junkPath = path.join(BUILD_DIR, 'junk_channels.json');
if (fs.existsSync(junkPath)) {
  fs.unlinkSync(junkPath);
}
console.log('  ✓ Removed local junk_channels.json');

// Update background.js with Supabase URL
console.log('\nStep 4: Configuring backend URL...');
const bgPath = path.join(BUILD_DIR, 'background.js');
if (fs.existsSync(bgPath)) {
  let bgContent = fs.readFileSync(bgPath, 'utf8');
  bgContent = bgContent.replace(
    /const SUPABASE_URL = 'https:\/\/your-project\.supabase\.co';/,
    "const SUPABASE_URL = 'https://mlgtlirrhlftjgfdsajy.supabase.co';"
  );
  bgContent = bgContent.replace(
    /const VALIDATE_ENDPOINT =.*?\/validate-license';/,
    "const VALIDATE_ENDPOINT = 'https://mlgtlirrhlftjgfdsajy.supabase.co/functions/v1/validate-license';"
  );
  fs.writeFileSync(bgPath, bgContent);
  console.log('  ✓ Updated Supabase configuration');
}

// Create README
console.log('\nStep 5: Creating documentation...');
const readmeContent = `# PMax Sentry - Alpha Build

## Installation
1. Unzip this package
2. Open Chrome → chrome://extensions/
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select this folder

## License Activation
On first run, you'll be prompted to enter a license key.

### 10 Alpha License Keys (10 uses each):
1. PMX-ADNP-PYJ1-5AZ0
2. PMX-OHO2-JJ4F-TJ8P
3. PMX-35JN-CWUB-QWMB
4. PMX-H3GB-SPS8-QJ2V
5. PMX-IFJQ-EJIO-GMRB
6. PMX-1HCN-4JN3-2HWS
7. PMX-GIKG-ZOIR-I24G
8. PMX-I3Y9-BUYD-LVF9
9. PMX-GI6X-D0ED-0YU7
10. PMX-DPFG-0M84-L7B6

## Features
- Dual-tier detection (Confirmed + Suspected waste)
- 2,031 channel database
- International coverage
- O(1) performance

## Backend
- Supabase Project: https://mlgtlirrhlftjgfdsajy.supabase.co
- Edge Function: /functions/v1/validate-license

---
Build: ${new Date().toISOString()}
Version: 2.1.0-LICENSED
`;

fs.writeFileSync(path.join(BUILD_DIR, 'README.txt'), readmeContent);
console.log('  ✓ README.txt created');

// Create ZIP
console.log('\nStep 6: Creating distributable...');
const zipName = `pmax-sentry-v2.1-alpha.zip`;
const zipPath = path.join(__dirname, zipName);

try {
  process.chdir(BUILD_DIR);
  execSync(`zip -r "${zipPath}" .`);
  console.log(`  ✓ ${zipName} created`);
} catch (e) {
  console.log('  ⚠ ZIP creation failed, using fallback...');
  // Fallback: just copy the build folder
  console.log(`  ✓ Build folder ready at: ${BUILD_DIR}`);
}

// Summary
console.log('\n✅ Build Complete!');
console.log('===================');
console.log(`Output: ${BUILD_DIR}/`);
if (fs.existsSync(zipPath)) {
  console.log(`ZIP: ${zipPath}`);
  const stats = fs.statSync(zipPath);
  console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);
}
console.log('\nReady for testing!');