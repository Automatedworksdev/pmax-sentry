# PMax Sentry v2.1

**Dual-tier detection for Google Ads Performance Max campaigns**

Automatically identify and exclude low-quality YouTube placements.

---

## Features

- **Tier 1 (Confirmed)**: Channels in our junk database - highlighted in 🔴 RED
- **Tier 2 (Suspected)**: Contains junk keywords - highlighted in 🟡 YELLOW
- **One-click exclusion**: Select and exclude all waste placements
- **Wasted spend tracking**: See exactly how much money is being wasted

---

## Installation

1. Download `pmax-sentry-v2.1-PRODUCTION.zip`
2. Extract the ZIP file
3. Open Chrome → `chrome://extensions/`
4. Enable **Developer mode** (toggle top right)
5. Click **"Load unpacked"**
6. Select the extracted folder

---

## Activation

The extension requires a license key to function.

**Enter one of these keys:**
```
PMX-XZXB-6QJ9-6UVA
PMX-2YM5-IQPO-BPD8
PMX-K3HR-477M-CDVJ
PMX-7EO9-1V2I-Y2KX
PMX-NH16-07RQ-3E00
PMX-T48T-E547-WF94
PMX-D3BY-FQN9-N14T
PMX-KMN6-XXPF-TB2K
PMX-4GY5-KY93-751R
PMX-6FRO-KY99-ZI44
```

Each key has 10 uses.

---

## Usage

1. Navigate to **Google Ads → Campaigns → Placements**
2. Click the **PMax Sentry icon** in Chrome toolbar
3. Click **"Scan Placements"**
4. Review the **Tier 1** (confirmed) and **Tier 2** (suspected) matches
5. Click **"Exclude All"** to exclude waste placements

---

## Database

- **2,031 channels** categorized (Kids, Gaming, ASMR, News, etc.)
- **Dual-tier detection**: Confirmed + Suspected
- **O(1) performance**: No lag on large tables
- **International coverage**: EN/ES/PT/HI channels

---

## Technical

- **Manifest V3** Chrome extension
- **Supabase backend** for license validation
- **Local data storage** for offline operation after activation
- **Service worker** background script

---

## License

Alpha testing license keys provided. Contact for additional keys.

**Version**: 2.1.0  
**Build**: 2026-04-28