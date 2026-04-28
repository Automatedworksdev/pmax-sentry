// PMax Sentry - Massive Production Master Data Seeder
// Generates 2000+ categorized channels with international coverage

const fs = require('fs');
const path = require('path');

// ============================================
// CATEGORIZED CHANNEL DATABASE
// ============================================

const CATEGORIES = {
  knownOffenders: [
    { name: 'Cocomelon', type: 'Kids' },
    { name: 'Like Nastya', type: 'Kids' },
    { name: 'Blippi', type: 'Kids' },
    { name: 'Ryan ToysReview', type: 'Kids' },
    { name: 'Peppa Pig', type: 'Kids' },
    { name: 'Baby Shark', type: 'Kids' },
    { name: 'ChuChu TV', type: 'Kids' },
    { name: 'Little Baby Bum', type: 'Kids' },
    { name: 'Pinkfong', type: 'Kids' },
    { name: 'Vlad and Niki', type: 'Kids' },
    { name: 'Kids Diana Show', type: 'Kids' },
    { name: 'Toy Freaks', type: 'Kids' },
    { name: 'Freak Family', type: 'Kids' },
    { name: 'Bad Baby', type: 'Kids' },
    { name: 'Johny Johny Yes Papa', type: 'Kids' },
    { name: 'Finger Family', type: 'Kids' },
    { name: 'Masha and the Bear', type: 'Kids' },
    { name: 'PJ Masks', type: 'Kids' },
    { name: 'Spidey Adventures', type: 'Kids' },
    { name: 'Mickey Mouse', type: 'Kids' },
    { name: 'Minnie Mouse', type: 'Kids' },
    { name: 'Disney Junior', type: 'Kids' },
    { name: 'Nick Jr', type: 'Kids' },
    { name: 'Cartoon Network', type: 'Kids' },
    { name: 'Boomerang', type: 'Kids' },
    { name: 'Teen Titans Go', type: 'Kids' },
    { name: 'SpongeBob', type: 'Kids' },
    { name: 'Patrulha Canina', type: 'Kids' },
    { name: 'Peppa Portugues', type: 'Kids' },
    { name: 'Little Angel', type: 'Kids' },
    { name: 'LooLoo Kids', type: 'Kids' },
    { name: 'Gaby and Alex', type: 'Kids' },
    { name: 'Toys and Colors', type: 'Kids' },
    { name: 'Kinder Spielzeug', type: 'Kids' },
    { name: 'Little Baby Bum Brasil', type: 'Kids' },
    { name: 'ChuChu TV Hindi', type: 'Kids' },
    { name: 'Infobells Hindi', type: 'Kids' },
    { name: 'Rajshri Kids', type: 'Kids' },
    { name: 'Videogyan Hindi', type: 'Kids' },
    { name: ' Jugnu Kids', type: 'Kids' }
  ],
  
  kids: {
    prefixes: [
      'Baby', 'Little', 'Tiny', 'Mini', 'Nursery', 'Toddler', 'Kids', 'Children',
      'Super Baby', 'Fun Baby', 'Baby Shark', 'Mommy', 'Daddy', 'Family',
      'Learn With', 'Play With', 'Happy Baby', 'Smart Kids', 'Baby Genius',
      'Tiny Tots', 'Little Angels', 'Baby First', 'Peekaboo', 'Cuddle',
      'Sleepy Baby', 'Giggle', 'Laughing Baby', 'Baby Joy', 'Sweet Dreams',
      'Baby Club', 'Tots TV', 'Kiddie', 'Playhouse', 'Fun House', 'Wonder',
      // Spanish
      'Bebe', 'Pequeno', 'Ninos', 'Juguetes', 'Familia', 'Diversion',
      // Portuguese
      'Bebe', 'Pequeno', 'Criancas', 'Brinquedos', 'Familia',
      // Hindi
      'Bachcha', 'Chhota', 'Baccha', 'Khel', 'Parivar', 'Masti'
    ],
    suffixes: [
      'Rhymes', 'TV', 'Songs', 'Toys', 'Fun', 'World', 'Club', 'House',
      'Nursery', 'Kindergarten', 'Playtime', 'Learning', 'Education',
      'Colors', 'Numbers', 'ABC', '123', 'Animals', 'Cartoons', 'Shows',
      'Channel', 'Network', 'Studio', 'Videos', 'Sing-along', 'Dance',
      'Fun Time', 'Joy', 'Smile', 'Giggles', 'Adventures', 'Time',
      'Playground', 'Land', 'Zone', 'Corner', 'Spot', 'Center',
      // Spanish
      'Canciones', 'Juguetes', 'Diversion', 'Aprendiendo', 'Videos',
      // Portuguese
      'Musicas', 'Brinquedos', 'Diversao', 'Aprendendo', 'Videos',
      // Hindi
      'Geet', 'Khel', 'Siksha', 'Video', 'Masti', 'Kahaniya'
    ]
  },
  
  gaming: {
    prefixes: [
      'Minecraft', 'Roblox', 'Fortnite', 'Mobile Game', 'Gamer', 'Pro Gamer',
      'Gaming', 'Game', 'Play', 'Lets Play', 'Walkthrough', 'Gameplay',
      'Mod', 'Hack', 'Cheats', 'Unlimited', 'Free Gems', 'Tutorial',
      'Funny Moments', 'Fails', 'Epic', 'Pro', 'Noob', 'Troll',
      'Mobile Legends', 'PUBG', 'Call of Duty', 'Among Us', 'FNAF',
      'GTA', 'Grand Theft Auto', 'Zombie', 'Survival', 'Battle Royale',
      'Review', 'Game Review', 'Review Game', 'Honest Review',
      // International
      'Juego', 'Jogos', 'Gameplay Español', 'Gameplay Portugues'
    ],
    suffixes: [
      'Mods', 'Fun', 'Pro', 'XYZ', 'TV', 'Channel', 'Gameplay', 'Review',
      'Tips', 'Tricks', 'Guide', 'Tutorials', 'Hacks', 'Cheats', 'Free',
      'Unlimited', 'Generator', 'Online', 'Mobile', 'HD', '4K',
      'Compilation', 'Montage', 'Funny', 'Epic', 'Fails', 'Win',
      'Live', 'Stream', 'Daily', 'Weekly', 'Official',
      'Reviews', 'Review Channel', 'Game Reviews', 'Gaming Reviews'
    ]
  },
  
  asmr: {
    keywords: [
      'ASMR', 'Relaxing', 'Satisfying', 'Mukbang', 'Eating Sounds',
      'Whisper', 'Tapping', 'Crinkling', 'Roleplay', 'Sleep Help',
      'Meditation', 'Stress Relief', 'Tingles', 'Triggers'
    ],
    combinations: [
      'ASMR Relaxation', 'ASMR Sleep', 'ASMR Eating', 'ASMR Tingles',
      'Relaxing ASMR', 'Satisfying ASMR', 'ASMR Sounds', 'ASMR Triggers'
    ]
  },
  
  news: {
    regions: [
      // Asia
      'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan',
      'Myanmar', 'Thailand', 'Vietnam', 'Cambodia', 'Laos', 'Philippines',
      'Indonesia', 'Malaysia', 'Singapore', 'Brunei', 'Mongolia',
      // Middle East
      'UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
      'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Iran', 'Turkey', 'Israel',
      // Africa
      'Nigeria', 'Ghana', 'Kenya', 'Tanzania', 'Uganda', 'Rwanda',
      'Ethiopia', 'Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya',
      'South Africa', 'Zimbabwe', 'Botswana', 'Namibia',
      // Latin America
      'Mexico', 'Brazil', 'Argentina', 'Colombia', 'Peru', 'Chile',
      'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay',
      'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica',
      'Panama', 'Cuba', 'Dominican Republic', 'Puerto Rico',
      // Eastern Europe
      'Russia', 'Ukraine', 'Poland', 'Romania', 'Bulgaria', 'Hungary',
      'Czech Republic', 'Slovakia', 'Serbia', 'Croatia', 'Slovenia',
      'Lithuania', 'Latvia', 'Estonia', 'Belarus', 'Moldova',
      // Others
      'China', 'Taiwan', 'Hong Kong', 'South Korea', 'North Korea',
      'Japan', 'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea'
    ],
    outlets: [
      'News', 'Daily News', 'Breaking News', 'World News', 'Global News',
      '24 News', 'News 24', 'News Today', 'Today News', 'Latest News',
      'International News', 'Overseas News', 'Foreign News', 'Local News',
      'Regional News', 'City News', 'County News', 'State News', 'National News',
      'News Update', 'News Flash', 'News Alert', 'Top Stories', 'Headlines',
      'Daily Report', 'News Hour', 'Morning News', 'Evening News', 'Night News',
      'Weekend News', 'Sunday News', 'Monday News', 'News Channel', 'News Live'
    ]
  },
  
  music: {
    vevoPrefixes: [
      'VEVO', 'Official', 'Music', 'MTV', 'Billboard', 'Top Hits',
      'Pop Music', 'Hip Hop', 'Rap', 'Trap', 'EDM', 'Electronic',
      'Remix', 'Cover', 'Karaoke', 'Instrumental', 'Acoustic',
      'Live Performance', 'Concert', 'Session', 'Unplugged',
      'Audio Library', 'No Copyright', 'Royalty Free'
    ],
    vevoSuffixes: [
      'VEVO', 'Official', 'Music Video', 'Audio', 'Lyrics Video',
      'HD', '4K', 'Remix', 'Version', 'Radio Edit', 'Extended',
      'Club Mix', 'Dance Mix', 'Bootleg', 'Mashup', 'Cover',
      'Official Audio', 'Official Video', 'Audio Only'
    ],
    generic: [
      'Pop Hits', 'Top 40', 'Hit Music', 'Music Channel', 'Song Hits',
      'Video Hits', 'Chart Show', 'Countdown', 'Hit Parade',
      'Greatest Hits', 'Best Of', 'Collection', 'Playlist',
      'Streaming Music', 'Background Music', 'Study Music', 'Relaxation',
      'Sleep Music', 'Calm Music', 'Focus Music', 'Workout Music',
      'Party Music', 'Wedding Music', 'Romantic Songs', 'Love Songs',
      'Sad Songs', 'Breakup Songs', 'Motivational Songs', 'Devotional'
    ]
  },
  
  mobileRewards: {
    apps: [
      'AppTrailers', 'FeaturePoints', 'CashPirate', 'MoneyApp',
      'AppBounty', 'FreeMyApps', 'TapCash', 'CashForApps',
      'Slidejoy', 'Sweatcoin', 'Mistplay', 'Lucktastic',
      'InboxDollars', 'Swagbucks TV', 'Perk TV', 'Viggle',
      'CheckPoints', 'ShopKick', 'Receipt Hog', 'Fetch Rewards',
      'Dosh', 'Rakuten', 'Ibotta', 'Checkout 51',
      'Mobee', 'Field Agent', 'EasyShift', 'GigWalk',
      'HQ Trivia', 'Loco', 'SwagIQ', 'Joyride', 'ClipClaps',
      'Zynn', 'TikTok Rewards', 'SnackVideo', 'Kwai'
    ],
    generics: [
      'Reward App', 'Cash App', 'Money App', 'Earn App',
      'Survey App', 'Opinion App', 'Task App', 'Promo App',
      'Offer App', 'Deal App', 'Savings App', 'Free Gift App',
      'Gift Card App', 'Bonus App', 'Side Hustle', 'Passive Income'
    ]
  },
  
  compilation: {
    types: [
      'Funny', 'Fails', 'Wins', 'Viral', 'Trending', 'Amazing',
      'Satisfying', 'Cringe', 'Awkward', 'Epic', 'Best Of',
      'Worst Of', 'Top 10', 'Top 50', 'Top 100', 'Compilation',
      'Montage', 'Mashup', 'Remix', 'Reaction', 'Response'
    ],
    content: [
      'Videos', 'Clips', 'Moments', 'TikToks', 'Vines', 'Memes',
      'Tweets', 'Posts', 'Pictures', 'Photos', 'Gifs', 'Shorts'
    ]
  },
  
  generic: [
    'Entertainment HD', 'Movie Clips 24/7', 'Daily Funny', 'Viral Videos',
    'Trending Now', 'Top 10', 'Amazing Facts', 'Did You Know',
    'Fun Facts', 'Life Hacks', 'DIY Crafts', 'Prank Videos',
    'Funny Animals', 'Cute Pets', 'Fail Compilation', 'Win Compilation',
    'Extreme Sports', 'Stunts', 'Magic Tricks', 'Illusions',
    'Celebrity News', 'Gossip', 'Entertainment News', 'Hollywood Gossip',
    'Music Hits', 'Pop Songs', 'Remix', 'Cover Songs', 'Karaoke',
    'Relaxing Music', 'Study Music', 'Sleep Music', 'Meditation',
    'Satisfying Videos', 'Slime', 'Squishy', 'Fidget', 'TikTok Compilation',
    'Vine Compilation', 'Meme Review', 'Dank Memes', 'Funny Memes',
    'Comedy Central', 'Stand Up', 'Prank Wars', 'Social Experiment',
    'Challenge Videos', 'Viral Trends', 'Internet Culture', 'Web Series'
  ]
};

// Tier 2 Suspected Keywords
const SUSPECTED_KEYWORDS = [
  'Kids', 'Kid', 'Toy', 'Toys', 'Nursery', 'Baby', 'Toddler', 'Child', 'Children',
  'Rhyme', 'Rhymes', 'Song', 'Songs', 'Cartoon', 'Animation', 'Play', 'Fun',
  'Minecraft', 'Roblox', 'Gamer', 'Gaming', 'Game', 'Gameplay', 'Walkthrough',
  'Review', 'Reviews', 'Unboxing', 'Haul', 'ASMR', 'Mukbang', 'Eating',
  'Free', 'Unlimited', 'Hack', 'Mod', 'Cheats', 'Generator', 'Rewards',
  'Vevo', 'Music Video', 'Official Video', 'Lyrics', 'Audio', 'Remix',
  'Compilation', 'Montage', 'Fails', 'Funny Moments', 'Viral',
  // Spanish
  'Ninos', 'Juguetes', 'Canciones', 'Juego', 'Gratis', 'Musica',
  // Portuguese
  'Criancas', 'Brinquedos', 'Musicas', 'Jogos', 'Gratis',
  // Hindi
  'Baccha', 'Khel', 'Geet', 'Masti', 'Natak', 'Video'
];

// ============================================
// GENERATOR FUNCTIONS
// ============================================

function generateCombinations(prefixes, suffixes, type, count) {
  const results = [];
  const used = new Set();
  
  while (results.length < count && used.size < prefixes.length * suffixes.length) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const name = `${prefix} ${suffix}`;
    
    if (!used.has(name)) {
      used.add(name);
      results.push({ name, type });
    }
  }
  
  return results;
}

function generateNewsChannels(count) {
  const results = [];
  const { regions, outlets } = CATEGORIES.news;
  
  for (const outlet of outlets) {
    for (const region of regions) {
      if (results.length >= count) break;
      results.push({ name: `${region} ${outlet}`, type: 'News' });
      results.push({ name: `${outlet} ${region}`, type: 'News' });
    }
    if (results.length >= count) break;
  }
  
  return results.slice(0, count);
}

function generateMusicChannels(count) {
  const results = [];
  const { vevoPrefixes, vevoSuffixes, generic } = CATEGORIES.music;
  
  // VEVO combinations
  for (const prefix of vevoPrefixes) {
    for (const suffix of vevoSuffixes) {
      if (results.length >= count * 0.6) break;
      results.push({ name: `${prefix} ${suffix}`, type: 'Music' });
    }
  }
  
  // Generic music channels
  for (const name of generic) {
    results.push({ name, type: 'Music' });
  }
  
  // Numbered variants
  for (let i = 1; i <= 100 && results.length < count; i++) {
    results.push({ name: `Music Channel ${i}`, type: 'Music' });
    results.push({ name: `Hit Radio ${i}`, type: 'Music' });
  }
  
  return results.slice(0, count);
}

function generateASMRChannels(count) {
  const results = [];
  const { keywords, combinations } = CATEGORIES.asmr;
  
  // Predefined combinations
  for (const combo of combinations) {
    results.push({ name: combo, type: 'ASMR' });
  }
  
  // Generate combinations
  for (const kw1 of keywords) {
    for (const kw2 of keywords) {
      if (results.length >= count) break;
      if (kw1 !== kw2) {
        results.push({ name: `${kw1} ${kw2}`, type: 'ASMR' });
      }
    }
  }
  
  return results.slice(0, count);
}

function generateCompilationChannels(count) {
  const results = [];
  const { types, content } = CATEGORIES.compilation;
  
  for (const type of types) {
    for (const c of content) {
      if (results.length >= count) break;
      results.push({ name: `${type} ${c}`, type: 'Compilation' });
    }
  }
  
  return results.slice(0, count);
}

function generateMobileRewardChannels(count) {
  const results = [];
  const { apps, generics } = CATEGORIES.mobileRewards;
  
  // Real app names
  for (const app of apps) {
    results.push({ name: app, type: 'MobileRewards' });
  }
  
  // Generic variants
  for (let i = 1; i <= 100 && results.length < count; i++) {
    for (const gen of generics) {
      if (results.length >= count) break;
      results.push({ name: `${gen} ${i}`, type: 'MobileRewards' });
    }
  }
  
  return results.slice(0, count);
}

function generateGamingChannels(count) {
  const results = [];
  const { prefixes, suffixes } = CATEGORIES.gaming;
  
  const combos = generateCombinations(prefixes, suffixes, 'Gaming', count);
  results.push(...combos);
  
  // Add review-specific
  for (let i = 1; i <= 50; i++) {
    results.push({ name: `Game Review ${i}`, type: 'Gaming' });
    results.push({ name: `Mobile Game Review ${i}`, type: 'Gaming' });
  }
  
  return results.slice(0, count);
}

// ============================================
// MAIN GENERATION
// ============================================

console.log('🛡️ PMax Sentry - Massive Production Master Seeder');
console.log('=================================================\n');

// Generate all categories
const kidsChannels = generateCombinations(
  CATEGORIES.kids.prefixes,
  CATEGORIES.kids.suffixes,
  'Kids',
  400
);
console.log(`✓ Generated ${kidsChannels.length} kids channels`);

const gamingChannels = generateGamingChannels(300);
console.log(`✓ Generated ${gamingChannels.length} gaming channels`);

const newsChannels = generateNewsChannels(400);
console.log(`✓ Generated ${newsChannels.length} news channels`);

const musicChannels = generateMusicChannels(300);
console.log(`✓ Generated ${musicChannels.length} music channels`);

const asmrChannels = generateASMRChannels(150);
console.log(`✓ Generated ${asmrChannels.length} ASMR channels`);

const compilationChannels = generateCompilationChannels(200);
console.log(`✓ Generated ${compilationChannels.length} compilation channels`);

const mobileChannels = generateMobileRewardChannels(200);
console.log(`✓ Generated ${mobileChannels.length} mobile reward channels`);

// Combine all
const allChannels = [
  ...CATEGORIES.knownOffenders,
  ...kidsChannels,
  ...gamingChannels,
  ...newsChannels,
  ...musicChannels,
  ...asmrChannels,
  ...compilationChannels,
  ...mobileChannels,
  ...CATEGORIES.generic.map(name => ({ name, type: 'Generic' }))
];

// Remove duplicates based on name
const uniqueMap = new Map();
for (const channel of allChannels) {
  if (!uniqueMap.has(channel.name.toLowerCase())) {
    uniqueMap.set(channel.name.toLowerCase(), channel);
  }
}

const uniqueChannels = Array.from(uniqueMap.values())
  .sort((a, b) => a.name.localeCompare(b.name));

console.log(`\n📊 Total unique channels: ${uniqueChannels.length}`);

// Count by category
const categoryCounts = {};
for (const ch of uniqueChannels) {
  categoryCounts[ch.type] = (categoryCounts[ch.type] || 0) + 1;
}

// Create production master object
const productionMaster = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  totalChannels: uniqueChannels.length,
  suspectedKeywords: SUSPECTED_KEYWORDS,
  categoryCounts,
  channels: uniqueChannels
};

// Write optimized JSON
const outputPath = path.join(__dirname, 'junk_channels.json');
fs.writeFileSync(outputPath, JSON.stringify(productionMaster, null, 2));

console.log(`\n✅ Production Master List saved!`);
console.log(`   File: ${outputPath}`);
console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
console.log(`   Channels: ${uniqueChannels.length}`);
console.log(`   Suspected Keywords: ${SUSPECTED_KEYWORDS.length}`);

console.log(`\n📁 Category Breakdown:`);
for (const [cat, count] of Object.entries(categoryCounts).sort((a,b) => b[1] - a[1])) {
  console.log(`   - ${cat}: ${count}`);
}

console.log(`\n🚀 Ready for Production with Dual-Tier Detection!`);