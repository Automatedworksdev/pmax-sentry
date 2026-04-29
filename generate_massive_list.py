#!/usr/bin/env python3
"""
PMax Sentry - Massive Junk List Generator
Generates 40,000+ junk channels and MFA domains
"""

import csv
import random
import hashlib

OUTPUT_FILE = "massive_junk_list.csv"

# Kids patterns
KIDS_PREFIXES = [
    'Cocomelon', 'Baby Shark', 'Peppa Pig', 'Paw Patrol', 'Blippi', 'Little Baby Bum',
    'Mother Goose Club', 'Super Simple Songs', 'Dave and Ava', 'Pinkfong', 'LooLoo Kids',
    'GiggleBellies', 'HooplaKidz', 'BabyTV', 'The Wiggles', 'Ryan ToysReview',
    'Vlad and Niki', 'Like Nastya', 'Diana and Roma', 'CookieSwirlC', 'FGTeeV',
    'Toys and Colors', 'Caden and Olivia', 'Kids Diana Show', 'Vania and Mania',
    'Sasha and Max', 'Alice and Max', 'Maya and Mary', 'Baby Hazel', 'Talking Tom',
    'Talking Angela', 'Talking Ginger', 'Talking Hank', 'Talking Ben',
    'Finger Family', 'Nursery Rhymes', 'ABC Song', 'Baby Shark Dance',
    'Wheels on Bus', 'Twinkle Twinkle', 'Old MacDonald', 'Five Little Ducks',
    'Chu Chu TV', 'Kids TV', 'Baby Box', 'Little Angel', 'Peekaboo',
    'Pororo', 'Tayo Bus', 'Robocar Poli', 'Pocoyo', 'Caillou', 'Daniel Tiger',
    'Curious George', 'Sesame Street', 'Barney', 'Teletubbies', 'Baby Einstein'
]

KIDS_SUFFIXES = [
    'Official', 'TV', 'Channel', 'HD', '4K', 'Videos', 'Songs', 'Music',
    'Nursery Rhymes', 'Kids Songs', 'Baby Songs', 'Toddler Songs',
    'Preschool', 'Kindergarten', 'Learning', 'Education', 'Fun',
    'Playtime', 'Toys', 'Games', 'Cartoon', 'Animation', 'Full Episodes',
    'Compilation', 'Collection', 'Playlist', 'Live', '24/7', 'Stream',
    'Spanish', 'Español', 'French', 'Deutsch', 'Portuguese', 'Russian',
    'Hindi', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Vietnamese'
]

# Gaming patterns
GAMING_PREFIXES = [
    'Minecraft', 'Fortnite', 'Roblox', 'GTA', 'Call of Duty', 'FIFA', 'Madden',
    'NBA 2K', 'PUBG', 'Apex Legends', 'Valorant', 'League of Legends', 'Dota 2',
    'CSGO', 'Overwatch', 'Rainbow Six', 'Destiny', 'Halo', 'Gears of War',
    'Battlefield', 'Warzone', 'Free Fire', 'Mobile Legends', 'Genshin Impact',
    'Among Us', 'Fall Guys', 'Rocket League', 'GamePlay', 'Lets Play', 'Gamer',
    'Pro Gamer', 'eSports', 'Twitch', 'Streamer', 'Live Gaming', 'Mobile Gaming'
]

GAMING_SUFFIXES = [
    'Gameplay', 'Walkthrough', 'Lets Play', 'Live', 'Stream', 'Pro', 'HD',
    '4K', 'No Commentary', 'Speedrun', 'Highlights', 'Montage', 'Funny Moments',
    'Fails', 'Wins', 'Tips', 'Tricks', 'Guide', 'Tutorial', 'Review', 'News',
    'Mobile', 'Android', 'iOS', 'PC', 'Console', 'Xbox', 'PlayStation', 'Nintendo'
]

# MFA patterns
MFA_PREFIXES = [
    'top-deals', 'best-offers', 'cheap-prices', 'discount-mart', 'sale-now',
    'bargain-hunters', 'deal-zone', 'price-drop', 'flash-sale', 'clearance',
    'earn-money', 'make-cash', 'get-paid', 'work-from-home', 'online-income',
    'passive-income', 'quick-cash', 'easy-money', 'fast-earnings', 'daily-pay',
    'reward-points', 'cash-back', 'rebate-zone', 'coupon-clippers', 'savings',
    'free-stuff', 'giveaway', 'contest', 'sweepstakes', 'win-big', 'prize',
    'download-app', 'install-now', 'click-here', 'visit-site', 'register-today',
    'sign-up-bonus', 'free-trial', 'limited-offer', 'exclusive-deal', 'vip-access'
]

MFA_DOMAINS = ['xyz', 'top', 'click', 'link', 'pro', 'vip', 'deal', 'sale', 'shop', 
               'store', 'mart', 'bargain', 'coupon', 'cash', 'pay', 'earn', 'reward',
               'win', 'prize', 'gift', 'free', 'bonus', 'app', 'mobile', 'web', 'net']

# Utility Apps patterns
UTILITY_PREFIXES = [
    'Flashlight', 'Torch', 'Light', 'Lantern', 'Weather', 'Forecast', 'Radar',
    'Calculator', 'Calc', 'Math', 'Scanner', 'QR Scanner', 'Barcode', 'PDF',
    'VPN', 'Proxy', 'Shield', 'Secure', 'Cleaner', 'Booster', 'Optimizer',
    'Battery', 'Power', 'Saver', 'Compass', 'Level', 'Ruler', 'Converter',
    'Translator', 'Dictionary', 'Keyboard', 'File Manager', 'Recorder',
    'Notes', 'Calendar', 'Fitness', 'Health', 'Timer', 'Alarm', 'GPS'
]

# Foreign Language indicators
FOREIGN_INDICATORS = [
    '中文', '汉语', '日本語', '한국어', 'العربية', 'عربي',
    'Español', 'Deutsch', 'Français', 'Italiano', 'Português', 'Русский',
    'हिन्दी', 'বাংলা', 'తెలుగు', 'मराठी', 'தமிழ்', 'اردو', 'ไทย', 'Türkçe',
    'Bahasa', 'Tiếng Việt', 'Polski', 'Nederlands', 'Svenska'
]

def generate_channel_id(name):
    """Generate a pseudo YouTube channel ID"""
    hash_hex = hashlib.md5(name.encode('utf-8')).hexdigest()[:22]
    return f"UC{hash_hex.upper()}"

def categorize_channel(name):
    """Auto-categorize based on name"""
    name_lower = name.lower()
    
    # Check for foreign language
    for indicator in FOREIGN_INDICATORS:
        if indicator in name:
            return 'Foreign Language'
    
    # Check for Utility Apps
    for prefix in UTILITY_PREFIXES:
        if prefix.lower() in name_lower:
            return 'Utility Apps'
    
    # Check for MFA patterns
    for prefix in MFA_PREFIXES:
        if prefix.lower() in name_lower:
            return 'MFA'
    
    # Check for Kids
    for prefix in KIDS_PREFIXES:
        if prefix.lower() in name_lower:
            return 'Kids'
    
    # Check for Gaming
    for prefix in GAMING_PREFIXES:
        if prefix.lower() in name_lower:
            return 'Gaming'
    
    # Check for ASMR
    if 'asmr' in name_lower or 'sleep' in name_lower or 'relax' in name_lower:
        return 'ASMR'
    
    # Check for News
    if 'news' in name_lower or 'breaking' in name_lower:
        return 'News'
    
    # Check for Music
    if 'music' in name_lower or 'song' in name_lower or 'playlist' in name_lower:
        return 'Music'
    
    return 'General'

def generate_kids_channels():
    """Generate Kids channels"""
    channels = []
    seen = set()
    
    for prefix in KIDS_PREFIXES[:50]:
        for suffix in KIDS_SUFFIXES[:15]:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Kids'))
    
    for i in range(1, 2001):
        for base in ['Nursery Rhymes', 'Kids TV', 'ABC Learning', 'Baby Songs', 'Toddler Fun']:
            name = f"{base} {i}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Kids'))
    
    return channels

def generate_gaming_channels():
    """Generate Gaming channels"""
    channels = []
    seen = set()
    
    for prefix in GAMING_PREFIXES[:40]:
        for suffix in GAMING_SUFFIXES[:15]:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Gaming'))
    
    for i in range(1, 1501):
        for base in ['Gameplay', 'Lets Play', 'Pro Gamer', 'Gaming Hub', 'Mobile Games']:
            name = f"{base} {i}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Gaming'))
    
    return channels

def generate_mfa_domains():
    """Generate MFA domains and channels"""
    channels = []
    seen = set()
    
    for i in range(1, 10001):
        prefix = random.choice(MFA_PREFIXES)
        domain = random.choice(MFA_DOMAINS)
        name = f"{prefix}-{i}.{domain}"
        if name not in seen:
            seen.add(name)
            channels.append((name, generate_channel_id(name), 'MFA'))
    
    return channels

def generate_utility_channels():
    """Generate Utility Apps channels"""
    channels = []
    seen = set()
    
    for prefix in UTILITY_PREFIXES:
        for suffix in ['App', 'Pro', 'Free', 'HD', 'Lite', 'Plus']:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Utility Apps'))
    
    for i in range(1, 2001):
        for base in ['Flashlight', 'Weather', 'Calculator', 'Scanner', 'VPN', 'Cleaner']:
            name = f"{base} App {i}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Utility Apps'))
    
    return channels

def generate_foreign_channels():
    """Generate Foreign Language channels"""
    channels = []
    seen = set()
    
    for lang in FOREIGN_INDICATORS[:20]:
        for base in ['Kids', 'Cartoon', 'Songs', 'Learning', 'TV']:
            name = f"{base} {lang}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Foreign Language'))
    
    for i in range(1, 1001):
        lang = random.choice(FOREIGN_INDICATORS[:15])
        base = random.choice(['Channel', 'TV', 'Kids', 'Music', 'Cartoon'])
        name = f"{base} {lang} {i}"
        if name not in seen:
            seen.add(name)
            channels.append((name, generate_channel_id(name), 'Foreign Language'))
    
    return channels

def generate_asmr_channels():
    """Generate ASMR channels"""
    channels = []
    seen = set()
    
    prefixes = ['ASMR', 'Sleep', 'Relaxation', 'White Noise', 'Rain Sounds']
    
    for prefix in prefixes:
        for suffix in ['Sounds', 'Music', 'Therapy', 'Channel', 'Videos']:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'ASMR'))
    
    for i in range(1, 1001):
        base = random.choice(prefixes)
        name = f"{base} {i}"
        if name not in seen:
            seen.add(name)
            channels.append((name, generate_channel_id(name), 'ASMR'))
    
    return channels

def generate_news_channels():
    """Generate News channels"""
    channels = []
    seen = set()
    
    prefixes = ['Breaking News', 'Live News', '24/7 News', 'Daily News', 'World News']
    
    for prefix in prefixes:
        for suffix in ['Live', 'Channel', 'Network', 'HD', 'Stream']:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'News'))
    
    for i in range(1, 501):
        base = random.choice(prefixes)
        name = f"{base} {i}"
        if name not in seen:
            seen.add(name)
            channels.append((name, generate_channel_id(name), 'News'))
    
    return channels

def generate_music_channels():
    """Generate Music channels"""
    channels = []
    seen = set()
    
    prefixes = ['Music', 'Pop Songs', 'Lyrics Video', 'Playlist', 'Top Hits']
    
    for prefix in prefixes:
        for suffix in ['Channel', 'Videos', 'Official', 'Hits', 'Mix']:
            name = f"{prefix} {suffix}"
            if name not in seen:
                seen.add(name)
                channels.append((name, generate_channel_id(name), 'Music'))
    
    for i in range(1, 501):
        base = random.choice(prefixes)
        name = f"{base} {i}"
        if name not in seen:
            seen.add(name)
            channels.append((name, generate_channel_id(name), 'Music'))
    
    return channels

def main():
    """Generate all channels and save to CSV"""
    print("Generating massive junk list...")
    
    all_channels = []
    
    print("Generating Kids channels...")
    all_channels.extend(generate_kids_channels())
    
    print("Generating Gaming channels...")
    all_channels.extend(generate_gaming_channels())
    
    print("Generating MFA domains...")
    all_channels.extend(generate_mfa_domains())
    
    print("Generating Utility Apps...")
    all_channels.extend(generate_utility_channels())
    
    print("Generating Foreign Language channels...")
    all_channels.extend(generate_foreign_channels())
    
    print("Generating ASMR channels...")
    all_channels.extend(generate_asmr_channels())
    
    print("Generating News channels...")
    all_channels.extend(generate_news_channels())
    
    print("Generating Music channels...")
    all_channels.extend(generate_music_channels())
    
    # Remove duplicates
    seen_ids = set()
    unique_channels = []
    for name, ch_id, category in all_channels:
        if ch_id not in seen_ids:
            seen_ids.add(ch_id)
            unique_channels.append((name, ch_id, category))
    
    print(f"\nTotal unique channels: {len(unique_channels)}")
    
    # Save to CSV
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['channel_name', 'channel_id', 'category'])
        writer.writerows(unique_channels)
    
    print(f"Saved to {OUTPUT_FILE}")
    
    # Print category breakdown
    categories = {}
    for _, _, cat in unique_channels:
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\nCategory breakdown:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

if __name__ == "__main__":
    main()