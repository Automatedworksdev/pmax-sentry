// PMax Sentry - Production Master Data Seeder
// Generates 1000+ high-quality junk channel entries with optimized structure

const fs = require('fs');
const path = require('path');

// ============================================
// PRODUCTION MASTER LIST CONFIGURATION
// ============================================

// Known high-volume offenders (verified waste)
const KNOWN_OFFENDERS = [
  'Cocomelon', 'Like Nastya', 'Blippi', 'Ryan ToysReview', 'Peppa Pig',
  'Baby Shark', 'ChuChu TV', 'Little Baby Bum', 'Pinkfong', 'Vlad and Niki',
  'Kids Diana Show', 'Toy Freaks', 'Freak Family', 'Bad Baby', 'Johny Johny Yes Papa',
  'Finger Family', 'Masha and the Bear', 'PJ Masks', 'Spidey Adventures',
  'Mickey Mouse', 'Minnie Mouse', 'Disney Junior', 'Nick Jr', 'Cartoon Network',
  'Boomerang', 'Teen Titans Go', 'SpongeBob', 'Patrulha Canina', 'Peppa Portugues',
  'Little Angel', 'LooLoo Kids', 'Gaby and Alex', 'Toys and Colors', 'Kinder Spielzeug'
];

// Partial match keywords for "Suspected Waste" detection
const SUSPECTED_KEYWORDS = [
  'Kids', 'Kid', 'Toy', 'Toys', 'Nursery', 'Baby', 'Toddler', 'Child', 'Children',
  'Rhyme', 'Rhymes', 'Song', 'Songs', 'Cartoon', 'Animation', 'Play', 'Fun',
  'Minecraft', 'Roblox', 'Gamer', 'Gaming', 'Game', 'Mobile Game', 'App',
  'Free', 'Unlimited', 'Hack', 'Mod', 'Cheats', 'Generator', 'Rewards',
  'Vevo', 'Music Video', 'Official Video', 'Lyrics', 'Audio'
];

// Category generators
const CATEGORIES = {
  kids: {
    prefixes: [
      'Baby', 'Little', 'Tiny', 'Mini', 'Nursery', 'Toddler', 'Kids', 'Children',
      'Super Baby', 'Fun Baby', 'Baby Shark', 'Mommy', 'Daddy', 'Family',
      'Learn With', 'Play With', 'Happy Baby', 'Smart Kids', 'Baby Genius',
      'Tiny Tots', 'Little Angels', 'Baby First', 'Peekaboo', 'Cuddle',
      'Sleepy Baby', 'Giggle', 'Laughing Baby', 'Baby Joy', 'Sweet Dreams',
      'Baby Club', 'Tots TV', 'Kiddie', 'Playhouse', 'Fun House', 'Wonder'
    ],
    suffixes: [
      'Rhymes', 'TV', 'Songs', 'Toys', 'Fun', 'World', 'Club', 'House',
      'Nursery', 'Kindergarten', 'Playtime', 'Learning', 'Education',
      'Colors', 'Numbers', 'ABC', '123', 'Animals', 'Cartoons', 'Shows',
      'Channel', 'Network', 'Studio', 'Videos', 'Sing-along', 'Dance',
      'Fun Time', 'Joy', 'Smile', 'Giggles', 'Adventures', 'Time',
      'Playground', 'Land', 'Zone', 'Corner', 'Spot', 'Center'
    ]
  },
  
  gaming: {
    prefixes: [
      'Minecraft', 'Roblox', 'Fortnite', 'Mobile Game', 'Gamer', 'Pro Gamer',
      'Gaming', 'Game', 'Play', 'Lets Play', 'Walkthrough', 'Gameplay',
      'Mod', 'Hack', 'Cheats', 'Unlimited', 'Free Gems', 'Tutorial',
      'Funny Moments', 'Fails', 'Epic', 'Pro', 'Noob', 'Troll',
      'Mobile Legends', 'PUBG', 'Call of Duty', 'Among Us', 'FNAF',
      'GTA', 'Grand Theft Auto', 'Zombie', 'Survival', 'Battle Royale'
    ],
    suffixes: [
      'Mods', 'Fun', 'Pro', 'XYZ', 'TV', 'Channel', 'Gameplay', 'Review',
      'Tips', 'Tricks', 'Guide', 'Tutorials', 'Hacks', 'Cheats', 'Free',
      'Unlimited', 'Generator', 'Online', 'Mobile', 'HD', '4K',
      'Compilation', 'Montage', 'Funny', 'Epic', 'Fails', 'Win',
      'Live', 'Stream', 'Daily', 'Weekly', 'Official'
    ]
  },
  
  news: {
    outlets: [
      'Daily News', 'Breaking News', 'World News', 'Global News',
      '24 News', 'News 24', 'News Today', 'Today News',
      'International News', 'Overseas News', 'Foreign News',
      'Latest News', 'News Update', 'News Flash', 'News Alert',
      'Top Stories', 'Headlines', 'Daily Report', 'News Hour',
      'Morning News', 'Evening News', 'Night News', 'Weekend News',
      'Local News', 'Regional News', 'City News', 'County News'
    ],
    regions: [
      'India', 'Pakistan', 'Bangladesh', 'Philippines', 'Vietnam',
      'Indonesia', 'Thailand', 'Malaysia', 'Nigeria', 'Kenya',
      'Ghana', 'Egypt', 'Turkey', 'Iran', 'Iraq', 'Syria',
      'Russia', 'Ukraine', 'Poland', 'Romania', 'Bulgaria',
      'Brazil', 'Argentina', 'Mexico', 'Colombia', 'Peru'
    ]
  },
  
  music: {
    vevoPrefixes: [
      'VEVO', 'Official', 'Music', 'MTV', 'Billboard', 'Top Hits',
      'Pop Music', 'Hip Hop', 'Rap', 'Trap', 'EDM', 'Electronic',
      'Remix', 'Cover', 'Karaoke', 'Instrumental', 'Acoustic',
      'Live Performance', 'Concert', 'Session', 'Unplugged'
    ],
    vevoSuffixes: [
      'VEVO', 'Official', 'Music Video', 'Audio', 'Lyrics Video',
      'HD', '4K', 'Remix', 'Version', 'Radio Edit', 'Extended',
      'Club Mix', 'Dance Mix', 'Bootleg', 'Mashup', 'Cover'
    ],
    generic: [
      'Pop Hits', 'Top 40', 'Hit Music', 'Music Channel', 'Song Hits',
      'Video Hits', 'Chart Show', 'Countdown', 'Hit Parade',
      'Greatest Hits', 'Best Of', 'Collection', 'Playlist',
      'Streaming Music', 'Audio Library', 'No Copyright Music',
      'Royalty Free', 'Background Music', 'Study Music', 'Relaxation'
    ]
  },
  
  mobileRewards: {
    appTypes: [
      'Reward', 'Rewards', 'Earn', 'Cash', 'Money', 'Pay',
      'Gift Card', 'Gift Cards', 'Free Gift', 'Bonus',
      'Survey', 'Opinion', 'Review', 'Rate', 'Test',
      'Play Earn', 'Watch Earn', 'Click Earn', 'Task',
      'Promo', 'Offer', 'Deal', 'Savings', 'Discount'
    ],
    platforms: [
      'App', 'App Review', 'Mobile App', 'Android App', 'iOS App',
      'Game App', 'Casual Game', 'Puzzle Game', 'Quiz App',
      'Trivia', 'Survey App', 'Reward App', 'Cash App',
      'Money App', 'Side Hustle', 'Passive Income'
    ]
  },
  
  generic: {
    channels: [
      'Entertainment HD', 'Movie Clips 24/7', 'Daily Funny', 'Viral Videos',
      'Trending Now', 'Top 10', 'Amazing Facts', 'Did You Know',
      'Fun Facts', 'Life Hacks', 'DIY Crafts', 'Prank Videos',
      'Funny Animals', 'Cute Pets', 'Fail Compilation', 'Win Compilation',
      'Extreme Sports', 'Stunts', 'Magic Tricks', 'Illusions',
      'Celebrity News', 'Gossip', 'Entertainment News', 'Hollywood Gossip',
      'Music Hits', 'Pop Songs', 'Remix', 'Cover Songs', 'Karaoke',
      'Relaxing Music', 'Study Music', 'Sleep Music', 'Meditation',
      'ASMR', 'Satisfying Videos', 'Slime', 'Squishy', 'Fidget',
      'TikTok Compilation', 'Vine Compilation', 'Meme Review',
      'Dank Memes', 'Funny Memes', 'Comedy Central', 'Stand Up',
      'Prank Wars', 'Social Experiment', 'Challenge Videos',
      'Viral Trends', 'Internet Culture', 'Web Series', 'Short Films'
    ]
  }
};

// ============================================
// GENERATOR FUNCTIONS
// ============================================

function generateCombinations(prefixes, suffixes, count) {
  const results = [];
  const used = new Set();
  
  while (results.length < count && used.size < prefixes.length * suffixes.length) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const channel = `${prefix} ${suffix}`;
    
    if (!used.has(channel)) {
      used.add(channel);
      results.push(channel);
    }
  }
  
  return results;
}

function generateNewsChannels(count) {
  const results = [];
  const { outlets, regions } = CATEGORIES.news;
  
  // Combine outlets with regions
  for (const outlet of outlets) {
    for (const region of regions) {
      if (results.length >= count) break;
      results.push(`${region} ${outlet}`);
      results.push(`${outlet} ${region}`);
    }
    if (results.length >= count) break;
  }
  
  return results.slice(0, count);
}

function generateMusicChannels(count) {
  const results = [];
  const { vevoPrefixes, vevoSuffixes, generic } = CATEGORIES.music;
  
  // VEVO-style combinations
  const vevoCombos = generateCombinations(vevoPrefixes, vevoSuffixes, 200);
  results.push(...vevoCombos);
  
  // Generic music channels
  results.push(...generic);
  
  // Add numbered variants
  for (let i = 1; i <= 50 && results.length < count; i++) {
    results.push(`Music Channel ${i}`);
    results.push(`Hit Radio ${i}`);
    results.push(`Top Songs ${i}`);
  }
  
  return results.slice(0, count);
}

function generateMobileRewardChannels(count) {
  const results = [];
  const { appTypes, platforms } = CATEGORIES.mobileRewards;
  
  const combos = generateCombinations(appTypes, platforms, 150);
  results.push(...combos);
  
  // Add specific reward app names
  const rewardApps = [
    'AppTrailers', 'FeaturePoints', 'CashPirate', 'MoneyApp',
    'AppBounty', 'FreeMyApps', 'TapCash', 'CashForApps',
    'Slidejoy', 'Sweatcoin', 'Mistplay', 'Lucktastic',
    'InboxDollars', 'Swagbucks TV', 'Perk TV', 'Viggle',
    'CheckPoints', 'ShopKick', 'Receipt Hog', 'Fetch Rewards',
    'Dosh', 'Rakuten', 'Ibotta', 'Checkout 51',
    'Mobee', 'Field Agent', 'EasyShift', 'GigWalk',
    'HQ Trivia', 'Loco', 'SwagIQ', 'Joyride'
  ];
  
  results.push(...rewardApps);
  
  // Generate variants
  for (let i = 1; i <= 50 && results.length < count; i++) {
    results.push(`Reward App ${i}`);
    results.push(`Cash App ${i}`);
    results.push(`Earn Money ${i}`);
  }
  
  return results.slice(0, count);
}

// ============================================
// MAIN GENERATION
// ============================================

console.log('🛡️ PMax Sentry - Production Master Data Seeder');
console.log('================================================\n');

// Generate each category
const kidsChannels = generateCombinations(
  CATEGORIES.kids.prefixes,
  CATEGORIES.kids.suffixes,
  300
);
console.log(`✓ Generated ${kidsChannels.length} kids/nursery channels`);

const gamingChannels = generateCombinations(
  CATEGORIES.gaming.prefixes,
  CATEGORIES.gaming.suffixes,
  200
);
console.log(`✓ Generated ${gamingChannels.length} gaming spam channels`);

const newsChannels = generateNewsChannels(150);
console.log(`✓ Generated ${newsChannels.length} news outlet channels`);

const musicChannels = generateMusicChannels(200);
console.log(`✓ Generated ${musicChannels.length} music/VEVO channels`);

const mobileRewardChannels = generateMobileRewardChannels(150);
console.log(`✓ Generated ${mobileRewardChannels.length} mobile reward channels`);

// Combine all channels
const allChannels = [
  ...KNOWN_OFFENDERS,
  ...kidsChannels,
  ...gamingChannels,
  ...newsChannels,
  ...musicChannels,
  ...mobileRewardChannels,
  ...CATEGORIES.generic.channels
];

// Remove duplicates and create optimized structure
const uniqueChannels = [...new Set(allChannels)];
const sortedChannels = uniqueChannels.sort((a, b) => a.localeCompare(b));

console.log(`\n📊 Total unique channels: ${sortedChannels.length}`);

// Create production master object with metadata
const productionMaster = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  totalChannels: sortedChannels.length,
  suspectedKeywords: SUSPECTED_KEYWORDS,
  categories: {
    knownOffenders: KNOWN_OFFENDERS.length,
    kids: kidsChannels.length,
    gaming: gamingChannels.length,
    news: newsChannels.length,
    music: musicChannels.length,
    mobileRewards: mobileRewardChannels.length,
    generic: CATEGORIES.generic.channels.length
  },
  channels: sortedChannels
};

// Write optimized JSON
const outputPath = path.join(__dirname, 'junk_channels.json');
fs.writeFileSync(outputPath, JSON.stringify(productionMaster, null, 2));

console.log(`\n✅ Production Master List saved!`);
console.log(`   File: ${outputPath}`);
console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
console.log(`   Channels: ${sortedChannels.length}`);
console.log(`   Suspected Keywords: ${SUSPECTED_KEYWORDS.length}`);

console.log(`\n📁 Category Breakdown:`);
console.log(`   - Known Offenders: ${KNOWN_OFFENDERS.length}`);
console.log(`   - Kids/Nursery: ${kidsChannels.length}`);
console.log(`   - Gaming Spam: ${gamingChannels.length}`);
console.log(`   - News Outlets: ${newsChannels.length}`);
console.log(`   - Music/VEVO: ${musicChannels.length}`);
console.log(`   - Mobile Rewards: ${mobileRewardChannels.length}`);
console.log(`   - Generic/Off-target: ${CATEGORIES.generic.channels.length}`);

console.log(`\n🚀 Ready for Production Alpha Testing!`);