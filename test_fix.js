// Test script to verify the extraction and classification logic

// Mock channel database (as would be loaded from storage)
const channelSet = new Set([
  'cocomelon',
  'cocomelon nursery rhymes',
  'kids tv',
  'kids tv fun channel',
  'cartoon network',
  'cartoon network live',
  'baby shark',
  'baby shark official',
  'peppa pig',
  'paw patrol',
  'gaming hub',
  'mobile games',
  'gameplay',
  'gameplay hub',
  'lets play',
  'esports',
  'esports live streamer',
  'gamer',
  'mobile gaming pro',
  'lets play games daily',
  'asmr',
  'sleep sounds',
  'relaxation',
  'meditation',
  'white noise',
  'asmr sleep sounds',
  'relaxation meditation channel',
  'breaking news',
  'live news',
  '24/7 news',
  'news channel',
  'daily news live 24/7',
  'breaking news channel',
  'live stream news today',
  'mobile reward',
  'app reward',
  'earn money',
  'cash app',
  'mobile reward app',
  'earn money fast app',
  'music playlist',
  'pop songs',
  'lyrics video'
]);

const suspectedKeywords = [
  'kids', 'kid', 'toy', 'toys', 'nursery', 'baby', 'toddler', 'child', 'children',
  'rhyme', 'rhymes', 'song', 'songs', 'cartoon', 'animation', 'play', 'fun',
  'minecraft', 'roblox', 'gamer', 'gaming', 'game', 'gameplay', 'walkthrough',
  'review', 'reviews', 'unboxing', 'haul', 'asmr', 'mukbang', 'eating',
  'free', 'unlimited', 'hack', 'mod', 'cheats', 'generator', 'rewards',
  'vevo', 'music video', 'official video', 'lyrics', 'audio', 'remix',
  'compilation', 'montage', 'fails', 'funny moments', 'viral',
  'news', 'breaking', 'live'
];

// Classification function (copied from content.js)
function classifyChannel(channelName) {
  const normalized = channelName.toLowerCase().trim();
  
  // Extract ID from URL if it's a YouTube/Play Store URL
  let channelId = normalized;
  const ytMatch = normalized.match(/\/channel\/(uc[\w-]+)/);
  const appMatch = normalized.match(/\?id=([\w.]+)/);
  if (ytMatch) channelId = ytMatch[1];
  else if (appMatch) channelId = appMatch[1];
  
  console.log('  classifyChannel:', { normalized, channelId });
  
  // Tier 1: Exact match (check both full name and extracted ID)
  if (channelSet.has(normalized) || channelSet.has(channelId)) {
    return { tier: 'tier1' };
  }
  
  // Tier 2: Keyword match
  for (const keyword of suspectedKeywords) {
    if (normalized.includes(keyword)) {
      return { tier: 'tier2', keyword };
    }
  }
  
  return { tier: 'none' };
}

// Test data from mock_test.html
const testCases = [
  // These should be Tier 1 (exact match in database)
  { displayName: 'Cocomelon Nursery Rhymes', href: 'https://www.youtube.com/channel/UC8772092824996032001', expected: 'tier1' },
  { displayName: 'Kids TV Fun Channel', href: 'https://www.youtube.com/channel/UCkYqhP5D4yPJC3r2YBq3h5A', expected: 'tier1' },
  { displayName: 'Cartoon Network Live', href: 'https://www.youtube.com/channel/UCuJyCaxPjx87RMaFPG-6qqg', expected: 'tier1' },
  { displayName: 'Baby Shark Official', href: 'https://www.youtube.com/channel/UCXbF2Rwb4j2rQyYkDH2pA1Q', expected: 'tier1' },
  
  // These should be Tier 2 (keyword match)
  { displayName: 'Mobile Gaming Pro', href: 'https://www.youtube.com/channel/UCv9S3dDK4P8PYE8f2k2m2rA', expected: 'tier2' },
  { displayName: 'Daily News Live 24/7', href: 'https://www.youtube.com/channel/UCY8r2b6d7e8f9g0h1i2j3kQ', expected: 'tier2' },
  { displayName: 'ASMR Sleep Sounds', href: 'https://www.youtube.com/channel/UCm1n2o3p4q5r6s7t8u9v0wQ', expected: 'tier2' },
  { displayName: 'Mobile Reward App', href: 'https://play.google.com/store/apps/details?id=com.mobilerewards.app', expected: 'tier2' },
  
  // These should be none (clean placements)
  { displayName: 'Tech Reviews Pro', href: 'https://www.youtube.com/channel/UC9f8g7h6i5j4k3l2m1n0b9v', expected: 'none' },
  { displayName: 'Business Insider', href: 'https://www.youtube.com/channel/UC1a2b3c4d5e6f7g8h9i0j1k', expected: 'none' },
];

console.log('=== PMax Sentry Classification Test ===\n');
console.log('Testing FIXED logic (using displayName first):\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, i) => {
  console.log(`Test ${i + 1}: "${test.displayName}"`);
  console.log(`  Href: ${test.href}`);
  
  // Fixed logic: use displayName first
  let result = classifyChannel(test.displayName);
  
  // If no match, try href
  if (result.tier === 'none' && test.href !== test.displayName) {
    result = classifyChannel(test.href);
  }
  
  const status = result.tier === test.expected ? '✓ PASS' : '✗ FAIL';
  if (result.tier === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`  Result: ${result.tier} (expected: ${test.expected}) ${status}`);
  if (result.keyword) {
    console.log(`  Matched keyword: ${result.keyword}`);
  }
  console.log('');
});

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);

// OLD logic test (using href first)
console.log('\n\n=== Testing OLD logic (using href first) - SHOULD FAIL ===\n');

testCases.slice(0, 4).forEach((test, i) => {
  console.log(`Test ${i + 1}: "${test.displayName}"`);
  
  // OLD logic: use href first
  const result = classifyChannel(test.href);
  
  const status = result.tier === test.expected ? '✓ PASS' : '✗ FAIL (as expected with old bug)';
  console.log(`  Result: ${result.tier} (expected: ${test.expected}) ${status}`);
  console.log('');
});
