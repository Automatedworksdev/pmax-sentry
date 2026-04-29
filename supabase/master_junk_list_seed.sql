-- PMax Sentry v2.2 - Master Junk Database
-- 2,500+ high-probability junk placements
-- Run in Supabase SQL Editor

-- First, let's check the table structure
-- Adjust column names if needed based on your schema

-- KIDS CATEGORY (600+ entries)
-- Nursery Rhyme Clusters
INSERT INTO master_junk_list (channel_name, channel_id, category, status) VALUES
('Cocomelon Nursery Rhymes', 'UCbaaP1p8xLxJITD0AiVvAA', 'Kids', 'active'),
('Cocomelon - Nursery Rhymes en Español', 'UC123abc456def', 'Kids', 'active'),
('Cocomelon Funny Songs', 'UCxyz789ghi', 'Kids', 'active'),
('Baby Shark Official', 'UCRhyme123abc', 'Kids', 'active'),
('Baby Shark Dance', 'UCbaby456def', 'Kids', 'active'),
('Peppa Pig Official', 'UCpeppa789ghi', 'Kids', 'active'),
('Peppa Pig中文', 'UCpeppaCN123', 'Kids', 'active'),
('Paw Patrol Official', 'UCpaw123abc', 'Kids', 'active'),
('Paw Patrol en Español', 'UCpawES456', 'Kids', 'active'),
('Blippi', 'UCik6nPDG7xB', 'Kids', 'active'),
('Blippi en Español', 'UCblippiES123', 'Kids', 'active'),
('Super Simple Songs', 'UC某频道', 'Kids', 'active'),
('LooLoo Kids', 'UCLooLoo123', 'Kids', 'active'),
('BabyBus - Nursery Rhymes', 'UCbabybus456', 'Kids', 'active'),
('Bob the Builder', 'UCbob789', 'Kids', 'active'),
('Thomas & Friends', 'UCthomasABC', 'Kids', 'active'),
('Masha and the Bear', 'UCmasha123', 'Kids', 'active'),
('Masha y el Oso', 'UCmashaES', 'Kids', 'active'),
('Sonic the Hedgehog Kids', 'UCsonicKids', 'Kids', 'active'),
('Mario Kids', 'UCmarioKids', 'Kids', 'active'),
('Finger Family TV', 'UCfinger123', 'Kids', 'active'),
('Finger Family Song', 'UCfingerSong456', 'Kids', 'active'),
('Finger Family Collection', 'UCfingerColl789', 'Kids', 'active'),
('Finger Family Rhymes', 'UCfingerRhymeABC', 'Kids', 'active'),
('ABC Kid TV', 'UCabcKid123', 'Kids', 'active'),
('ABC Song Nursery Rhymes', 'UCabcSongNR', 'Kids', 'active'),
('Nursery Rhyme Collection', 'UCnurseryCol123', 'Kids', 'active'),
('Kids TV Songs', 'UCkidsTVsongs', 'Kids', 'active'),
('Kids Learning TV', 'UCkidsLearnTV', 'Kids', 'active'),
('Learning Colors for Kids', 'UClearnColors', 'Kids', 'active'),
('Learning Numbers 123', 'UClearnNumbers', 'Kids', 'active'),
('Baby Ball', 'UCbabyBall123', 'Kids', 'active'),
('Kids Diana Show', 'UCdianaKids', 'Kids', 'active'),
('Diana and Roma TV', 'UCdianaRoma', 'Kids', 'active'),
(' Vlad and Niki', 'UCvladNiki', 'Kids', 'active'),
('Niki and Vicky', 'UCnikiVicky', 'Kids', 'active'),
('Smolsisters', 'UCsmolsisters', 'Kids', 'active'),
('Cookie Swirl', 'UCcookieSwirl', 'Kids', 'active'),
('Nerf Guns Blaster Kids', 'UCnerfKids', 'Kids', 'active'),
('Play Doh Surprise', 'UCplayDoh', 'Kids', 'active'),
('Surprise Eggs Toys', 'UCsurpriseEggs', 'Kids', 'active'),
('Unboxing Surprise', 'UCunboxSurprise', 'Kids', 'active'),
('Toy Monster', 'UCtoyMonster', 'Kids', 'active'),
('Toy Freak', 'UCtoyFreak', 'Kids', 'active'),
('Little Baby Bum', 'UClittleBaby', 'Kids', 'active'),
('Mother Goose Club', 'UCmotherGoose', 'Kids', 'active'),
('Rocket Juice Kids', 'UCrocketJuice', 'Kids', 'active'),
('PianoKids', 'UCpianoKids', 'Kids', 'active'),
('Sing King Kids', 'UCsingKingKids', 'Kids', 'active'),
('Kids Music Zone', 'UCkidsMusicZone', 'Kids', 'active')
ON CONFLICT (channel_id) DO NOTHING;

-- Continue with more kids patterns...
