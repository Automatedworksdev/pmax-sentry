// PMax Sentry - Junk Data Seeder
// Generates 300+ high-match-probability channel names

const fs = require('fs');
const path = require('path');

// Kids/Nursery combinations
const kidsPrefixes = [
  'Baby', 'Little', 'Tiny', 'Mini', 'Nursery', 'Toddler', 'Kids', 'Children',
  'Super Baby', 'Fun Baby', 'Baby Shark', 'Mommy', 'Daddy', 'Family',
  'Learn With', 'Play With', 'Happy Baby', 'Smart Kids', 'Baby Genius',
  'Tiny Tots', 'Little Angels', 'Baby First', 'Peekaboo', 'Cuddle',
  'Sleepy Baby', 'Giggle', 'Laughing Baby', 'Baby Joy', 'Sweet Dreams'
];

const kidsSuffixes = [
  'Rhymes', 'TV', 'Songs', 'Toys', 'Fun', 'World', 'Club', 'House',
  'Nursery', 'Kindergarten', 'Playtime', 'Learning', 'Education',
  'Colors', 'Numbers', 'ABC', '123', 'Animals', 'Cartoons', 'Shows',
  'Channel', 'Network', 'Studio', 'Videos', 'Sing-along', 'Dance',
  'Fun Time', 'Joy', 'Smile', 'Giggles', 'Adventures'
];

// Gaming spam combinations
const gamingPrefixes = [
  'Minecraft', 'Roblox', 'Fortnite', 'Mobile Game', 'Gamer', 'Pro Gamer',
  'Gaming', 'Game', 'Play', 'Lets Play', 'Walkthrough', 'Gameplay',
  'Mod', 'Hack', 'Cheats', 'Unlimited', 'Free Gems', 'Tutorial',
  'Funny Moments', 'Fails', 'Epic', 'Pro', 'Noob', 'Troll',
  'Mobile Legends', 'PUBG', 'Call of Duty', 'Among Us', 'FNAF'
];

const gamingSuffixes = [
  'Mods', 'Fun', 'Pro', 'XYZ', 'TV', 'Channel', 'Gameplay', 'Review',
  'Tips', 'Tricks', 'Guide', 'Tutorials', 'Hacks', 'Cheats', 'Free',
  'Unlimited', 'Generator', 'Online', 'Mobile', 'HD', '4K',
  'Compilation', 'Montage', 'Funny', 'Epic', 'Fails', 'Win'
];

// International/Off-target
const genericChannels = [
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
  'Prank Wars', 'Social Experiment', 'Challenge Videos'
];

// Known high-volume offenders (hardcoded)
const knownOffenders = [
  'Cocomelon', 'Like Nastya', 'Blippi', 'Ryan ToysReview', 'Peppa Pig',
  'Baby Shark', 'ChuChu TV', 'Little Baby Bum', 'Pinkfong',
  'Vlad and Niki', 'Kids Diana Show', 'Toy Freaks', 'Freak Family',
  'Bad Baby', 'Johny Johny Yes Papa', 'Finger Family',
  'Masha and the Bear', 'Paw Patrol', 'Peppa Pig Official',
  'PJ Masks', 'Spidey Adventures', 'Mickey Mouse', 'Minnie Mouse',
  'Disney Junior', 'Nick Jr', 'Cartoon Network', 'Boomerang',
  'Teen Titans Go', 'SpongeBob', 'Patrulha Canina', 'Peppa Portugues'
];

// Generate combinations
function generateChannels(prefixes, suffixes, count) {
  const channels = [];
  const used = new Set();
  
  while (channels.length < count && used.size < prefixes.length * suffixes.length) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const channel = `${prefix} ${suffix}`;
    
    if (!used.has(channel)) {
      used.add(channel);
      channels.push(channel);
    }
  }
  
  return channels;
}

// Build the junk list
console.log('🛡️ PMax Sentry - Junk Data Seeder');
console.log('=====================================\n');

// Generate 150 kids channels
const kidsChannels = generateChannels(kidsPrefixes, kidsSuffixes, 150);
console.log(`✓ Generated ${kidsChannels.length} kids/nursery channels`);

// Generate 100 gaming channels
const gamingChannels = generateChannels(gamingPrefixes, gamingSuffixes, 100);
console.log(`✓ Generated ${gamingChannels.length} gaming spam channels`);

// Combine all
const junkChannels = [
  ...knownOffenders,
  ...kidsChannels,
  ...gamingChannels,
  ...genericChannels
];

// Remove duplicates and shuffle
const uniqueChannels = [...new Set(junkChannels)]
  .sort(() => Math.random() - 0.5);

console.log(`✓ Total unique channels: ${uniqueChannels.length}`);

// Write to file
const outputPath = path.join(__dirname, 'junk_channels.json');
fs.writeFileSync(outputPath, JSON.stringify(uniqueChannels, null, 2));

console.log(`\n✅ Successfully wrote ${uniqueChannels.length} channels to junk_channels.json`);
console.log(`\nBreakdown:`);
console.log(`  - Known offenders: ${knownOffenders.length}`);
console.log(`  - Kids/Nursery: ${kidsChannels.length}`);
console.log(`  - Gaming spam: ${gamingChannels.length}`);
console.log(`  - Generic/Off-target: ${genericChannels.length}`);
console.log(`\nReady for Alpha testing!`);